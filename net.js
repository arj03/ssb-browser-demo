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

SSB.getProfileNameAsync = function(profileId, cb) {
  // Get only the name from a profile.
  // Encapsulated differently so that implementation can be changed out for faster versions without changing the API.
  console.log("Getting profile name using ssb-social-value")
  SSB.net.about.socialValue({ key: 'name', dest: profileId }, (err, value) => {
    if (err) {
      console.log("Got error from ssb-social-value: " + err)
      cb(err)
    } else if (value) {
      console.log("Got name from ssb-social-value: " + value)
      cb(null, value)
    } else {
      // Fall back to pulling it from the server.
      console.log("Falling back to getProfileAsync")
      SSB.getProfileAsync(profileId, (err, profile) => {
        if(err)
	  cb(err)
	else
	  cb(null, profile.name)
      })
    }
  })
}

SSB.getProfileAsync = function(profileId, cb) {
  const keysWeWant = ['name', 'description', 'image']
  SSB.net.about.socialValues({ keys: keysWeWant, dest: profileId }, (err, values) => {

  if(values) {
    // We've got it already.
    cb(null, values)
  } else {
    // Going to have to fetch it when a connection comes up.
    SSB.connectedWithData(() => {
      let rpc = SSB.getPeer()

      if(!rpc) cb("No peer to connect to")

      pull(
        rpc.partialReplication.getMessagesOfType({id: profileId, type: 'contact'}),
        pull.asyncMap(SSB.db.addOOO),
        pull.collect((err, msgs) => {
          SSB.net.about.socialValues({ keys: keysWeWant, dest: profileId }, (err, values) => {
            if(values) {
              cb(null, values)
            } else {
              cb(err)
            }
          })
        })
      )
      })
    }
  })
}
