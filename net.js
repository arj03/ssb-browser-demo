// this is loaded from ui/browser.js when SSB is ready
const pull = require('pull-stream')

// this uses https://github.com/arj03/ssb-partial-replication
SSB.syncFeedAfterFollow = function(feedId) {
  SSB.connected((rpc) => {
    delete SSB.state.feeds[feedId]
    SSB.db.last.setPartialLogState(feedId, false)

    console.time("downloading messages")

    pull(
      rpc.partialReplication.partialReplicationReverse({ id: feedId, limit: 100, keys: false }),
      pull.asyncMap(SSB.net.add),
      pull.collect((err) => {
        if (err) throw err

        console.timeEnd("downloading messages")
        SSB.state.queue = []
      })
    )
  })
}

SSB.syncFeedFromSequence = function(feedId, sequence, cb) {
  SSB.connected((rpc) => {
    var seqStart = sequence - 100
    if (seqStart < 0)
      seqStart = 0

    console.time("downloading messages")

    pull(
      rpc.partialReplication.partialReplication({ id: feedId, seq: seqStart, keys: false }),
      pull.asyncMap(SSB.net.add),
      pull.collect((err, msgs) => {
        if (err) throw err

        console.timeEnd("downloading messages")
        SSB.state.queue = []

        if (cb)
          cb()
      })
    )
  })
}

SSB.syncFeedFromLatest = function(feedId, cb) {
  SSB.connected((rpc) => {
    console.time("downloading messages")

    pull(
      rpc.partialReplication.partialReplicationReverse({ id: feedId, keys: false, limit: 25 }),
      pull.asyncMap(SSB.net.add),
      pull.collect((err, msgs) => {
        if (err) throw err

        console.timeEnd("downloading messages")
        SSB.state.queue = []

        if (cb)
          cb()
      })
    )
  })
}

SSB.syncLatestProfile = function(feedId, profile, latestSeq, cb) {
  SSB.connected((rpc) => {
    if (latestSeq <= 0) return cb()

    var seqStart = latestSeq - 200
    if (seqStart < 0)
      seqStart = 0

    pull(
      rpc.partialReplication.partialReplication({ id: feedId, seq: seqStart, keys: false, limit: 200 }),
      pull.collect((err, msgs) => {
        if (err) throw err

        msgs.reverse()

        msgs = msgs.filter((msg) => msg && msg.content.type == "about" && msg.content.about == feedId)

        for (var i = 0; i < msgs.length; ++i)
        {
          SSB.state = SSB.validate.appendOOO(SSB.state, null, msgs[i])
          if (SSB.state.error) return cb(SSB.state.error)

          var content = msgs[i].content

          if (content.name && !profile.name)
            profile.name = content.name

          if (!profile.image)
          {
            if (content.image && typeof content.image.link === 'string')
              profile.image = content.image.link
            else if (typeof content.image === 'string')
              profile.image = content.image
          }

          if (content.description && !profile.description)
            profile.description = content.description
        }

        if (profile.name && profile.image)
          cb(null, profile)
        else
          SSB.syncLatestProfile(feedId, profile, latestSeq - 200, cb)
      })
    )
  })
}


syncThread = function(messages, cb) {
  pull(
    pull.values(messages),
    pull.filter((msg) => msg && msg.content.type == "post"),
    pull.asyncMap((msg, cb) => {
      SSB.state = SSB.validate.appendOOO(SSB.state, null, msg)

      if (SSB.state.error) return cb(SSB.state.error)

      SSB.db.add(msg, cb)
    }),
    pull.collect(cb)
  )
}

// this uses https://github.com/arj03/ssb-get-thread plugin
SSB.getThread = function(msgId, cb)
{
  SSB.connected((rpc) => {
    rpc.getThread.get(msgId, (err, messages) => {
      if (err) return cb(err)

      syncThread(messages, cb)
    })
  })
}

SSB.getOOO = function(msgId, cb)
{
  SSB.connected((rpc) => {
    SSB.net.ooo.get(msgId, cb)
  })
}


