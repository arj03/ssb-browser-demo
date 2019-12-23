const pull = require('pull-stream')

const os = require('os')
const path = require('path')

// in browser this will be local storage
const dir = path.join(os.homedir(), ".ssb-lite")

const EventEmitter = require('events')
SSB = {
  events: new EventEmitter()
}

const s = require('sodium-browserify')
s.events.on('sodium-browserify:wasm loaded', function() {

  console.log("wasm loaded")

  var net = require('./server').init(dir)
  var db = require('./db').init(dir, net.id)

  console.log("my id: ", net.id)

  var helpers = require('./core-helpers')

  var validate = require('ssb-validate')
  var state = validate.initial()

  var last = db.last.get()
  // copy to so we avoid weirdness, because this object
  // tracks the state coming in to the database.
  for (var k in last) {
    state.feeds[k] = {
      id: last[k].id,
      timestamp: last[k].timestamp,
      sequence: last[k].sequence,
      queue: []
    }
  }

  // FIXME: refactor this into its own module instead of global object
  SSB = Object.assign(SSB, {
    db,
    net,
    dir,

    // helpers
    saveProfiles: helpers.saveProfiles,
    loadProfiles: helpers.loadProfiles,

    removeDB: helpers.removeDB,
    removeBlobs: helpers.removeBlobs,

    syncFeedAfterFollow: helpers.syncFeedAfterFollow,
    syncFeedFromSequence: helpers.syncFeedFromSequence,
    syncFeedFromLatest: helpers.syncFeedFromLatest,
    syncLatestProfile: helpers.syncLatestProfile,
    initialSync: helpers.initialSync,
    sync: helpers.sync,
    getThread: helpers.getThread,
    getOOO: helpers.getOOO,
    generateMessage: validate.appendNew,
    box: require('ssb-keys').box,
    state,

    blobFiles: require('ssb-blob-files'),

    // peer invites
    rawConnect: require('./raw-connect'),

    // sbot convenience wrappers
    publish: function(msg, cb) {
      state.queue = []
      state = validate.appendNew(state, null, net.config.keys, msg, Date.now())
      console.log(state.queue[0])
      db.add(state.queue[0].value, (err, data) => {
        db.last.update(data.value)
        net.post(data.value) // ebt
        cb(err, data)
      })
    },
    messagesByType: function(opts) {
      return pull(
        db.query.read({
          reverse: opts.reverse,
          limit: opts.limit,
          query: [{$filter: {value: { content: {type: opts.type}}}}, {$map: true}]
        })
      )
    },

    // config
    validMessageTypes: ['post', 'peer-invite/confirm', 'peer-invite/accept', 'peer-invite'],
    privateMessages: true,

    // will get added on load time:
    // - onboard
    // - remoteAddress
    profiles: {}
  })

  SSB.events.emit("SSB: loaded")
})
