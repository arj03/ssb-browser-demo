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

  // global object
  SSB = {
    db,
    net,
    dir,

    // helpers
    removeDB: helpers.removeDB,
    initialSync: helpers.initialSync
    // onboard will get added on load time
  }
})
