// this file is loaded from ui/browser.js when SSB is ready
const pull = require('pull-stream')

// this uses https://github.com/arj03/ssb-partial-replication
SSB.syncFeedAfterFollow = function(feedId) {
  SSB.syncFeedFromSequence(feedId, 0)
}

SSB.syncFeedFromSequence = function(feedId, sequence, cb) {
  let rpc = SSB.getPeer()

  var seqStart = sequence - 100
  if (seqStart < 0)
    seqStart = 0

  console.log(`seq ${seqStart} feedId: ${feedId}`)
  console.time("downloading messages")

  pull(
    rpc.partialReplication.getFeed({ id: feedId, seq: seqStart, keys: false }),
    pull.asyncMap(SSB.db.addOOO),
    pull.collect((err, msgs) => {
      if (err) throw err

      console.timeEnd("downloading messages")
      console.log(msgs.length)

      if (cb) cb()
    })
  )
}

SSB.syncFeedFromLatest = function(feedId, cb) {
  let rpc = SSB.getPeer()

  console.time("downloading messages")

  pull(
    rpc.partialReplication.getFeedReverse({ id: feedId, keys: false, limit: 25 }),
    pull.asyncMap(SSB.db.addOOO),
    pull.collect((err, msgs) => {
      if (err) throw err

      console.timeEnd("downloading messages")

      if (cb) cb()
    })
  )
}

syncThread = function(messages, cb) {
  pull(
    pull.values(messages),
    pull.filter((msg) => msg && msg.content.type == "post"),
    pull.asyncMap(SSB.db.addOOO),
    pull.collect(cb)
  )
}

// this uses https://github.com/arj03/ssb-partial-replication
SSB.getThread = function(msgId, cb) {
  let rpc = SSB.getPeer()

  rpc.partialReplication.getTangle(msgId, (err, messages) => {
    if (err) return cb(err)

    syncThread(messages, cb)
  })
}

SSB.isConnected = false
SSB.callbacksWaitingForConnection = []
function runConnectedCallbacks() {
  while(SSB.callbacksWaitingForConnection.length > 0) {
    const cb = SSB.callbacksWaitingForConnection.shift()
    cb(SSB)
  }
}

SSB.connected = function(cb) {
  // Add the callback to the list.
  SSB.callbacksWaitingForConnection.push(cb)

  if(SSB.isConnected) {
    // Already connected.  Run all the callbacks.
    runConnectedCallbacks()
  } else {
    // Register for the connect event so we can keep track of it.
    SSB.net.on('rpc:connect', (rpc) => {
      // Now we're connected.  Run all the callbacks.
      SSB.isConnected = true
      runConnectedCallbacks()

      // Register an event handler for disconnects so we know to trigger waiting again.
      rpc.on('closed', () => SSB.isConnected = false)
    }
  }
}

SSB.getOOO = function(msgId, cb) {
  SSB.connected((rpc) => {
    SSB.net.ooo.get(msgId, cb)
  }
}
