const pull = require('pull-stream')

const os = require('os')
const path = require('path')

// in browser this will be local storage
const dir = path.join(os.homedir(), ".ssb-lite")

const s = require('sodium-browserify')
s.events.on('sodium-browserify:wasm loaded', function() {

  console.log("wasm loaded")

  var net = require('./server').init(dir)
  var db = require('./db').init(dir, net.id)

  console.log("my id: ", net.id)

  var helpers = require('./core-helpers')

  var validate = require('ssb-validate')
  var state = validate.initial()

  db.last.get(function (_, last) {
    // copy to so we avoid weirdness, because this object
    // tracks the state coming in to the database.
    for (var k in last) {
      SSB.state.feeds[k] = {
        id: last[k].id,
        timestamp: last[k].ts || last[k].timestamp,
        sequence: last[k].sequence,
        queue: []
      }
    }
  })


  // FIXME: refactor this into its own module instead of global object
  SSB = {
    db,
    net,
    dir,

    // helpers
    removeDB: helpers.removeDB,
    initialSync: helpers.initialSync,
    sync: helpers.sync,
    getThread: helpers.getThread,
    appendNewMessage: validate.appendNew,
    box: require('ssb-keys').box,
    state,

    // config
    validMessageTypes: ['post'],
    privateMessages: true

    // will get added on load time:
    // - onboard
    // - remoteAddress
  }
})
