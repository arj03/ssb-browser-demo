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
  SSB.connectedWithData(() => {
    let rpc = SSB.getPeer()
  
    rpc.partialReplication.getTangle(msgId, (err, messages) => {
      if (err) return cb(err)
  
      syncThread(messages, cb)
    })
  })
}

SSB.activeConnections = 0
SSB.activeConnectionsWithData = 0
SSB.callbacksWaitingForConnection = []
SSB.callbacksWaitingForConnectionWithData = []
function runConnectedCallbacks() {
  while(SSB.callbacksWaitingForConnection.length > 0) {
    const cb = SSB.callbacksWaitingForConnection.shift()
    cb(SSB)
  }
}

function runConnectedWithDataCallbacks() {
  while(SSB.callbacksWaitingForConnectionWithData.length > 0) {
    const cb = SSB.callbacksWaitingForConnectionWithData.shift()
    cb(SSB)
  }
}

SSB.isConnected = function() {
  return (SSB.activeConnections > 0)
}

SSB.isConnectedWithData = function() {
  return (SSB.activeConnectionsWithData > 0)
}

SSB.connected = function(cb) {
  // Add the callback to the list.
  SSB.callbacksWaitingForConnection.push(cb);

  if(SSB.isConnected()) {
    // Already connected.  Run all the callbacks.
    runConnectedCallbacks()
  }
}

SSB.connectedWithData = function(cb) {
  // Register a callback for when we're connected to a peer with data (not a room).
  SSB.callbacksWaitingForConnectionWithData.push(cb);

  if(SSB.isConnectedWithData()) {
    // Already connected.  Run all the callbacks.
    runConnectedWithDataCallbacks()
  }
}

// Register for the connect event so we can keep track of it.
SSB.net.on('rpc:connect', (rpc) => {
  // Now we're connected.  Run all the callbacks.
  ++SSB.activeConnections
  runConnectedCallbacks()

  // Register an event handler for disconnects so we know to trigger waiting again.
  rpc.on('closed', () => --SSB.activeConnections)

  // See if we're operating on a connection with actual data (not a room).
  let connPeers = Array.from(SSB.net.conn.hub().entries())
  connPeers = connPeers.filter(([,x])=>!!x.key).map(([address,data])=>({
    address,
    data
  }))
  var peer = connPeers.find(x=>x.data.key == rpc.id)
  if (peer && peer.data.type != 'room') {
    // It's not a room.
    ++SSB.activeConnectionsWithData
    runConnectedWithDataCallbacks()

    // Register another callback to decrement our "connections with data" reference count.
    rpc.on('closed', () => --SSB.activeConnectionsWithData)
  }
})

SSB.getOOO = function(msgId, cb) {
  SSB.connectedWithData((rpc) => {
    SSB.net.ooo.get(msgId, cb)
  })
}

SSB.getProfileAsync = function(profileId, cb) {
  const profiles = SSB.db.getIndex('profiles').getProfiles()

  if(profiles[profileId]) {
    // We've got it already.
    cb(null, profiles[profileId])
  } else {
    // Don't have it yet.  Let's try loading the graph.
    SSB.db.getIndex('contacts').getGraphForFeedHops1(profileId, (err, data) => {
      const profiles = SSB.db.getIndex('profiles').getProfiles()

      if(!err && profiles[profileId]) {
        // Got it from graph.
        cb(null, profiles[profileId])
      } else {
        // Going to have to fetch it when a connection comes up.
        SSB.connectedWithData(() => {
          let rpc = SSB.getPeer()

          if(!rpc) cb("No peer to connect to")

          pull(
            rpc.partialReplication.getMessagesOfType({id: profileId, type: 'contact'}),
            pull.asyncMap(SSB.db.addOOO),
            pull.collect((err, msgs) => {
              if(err) cb(err)

              const profiles = SSB.db.getIndex('profiles').getProfiles()
              if (profiles[profileId])
                cb(null, profiles[profileId])
            })
          )
        })
      }
    })
  }
}
