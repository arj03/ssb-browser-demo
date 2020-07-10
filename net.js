// this is loaded from ui/browser.js when SSB is ready
const pull = require('pull-stream')

// this uses https://github.com/arj03/ssb-partial-replication
SSB.syncFeedAfterFollow = function(feedId) {
  SSB.syncFeedFromSequence(feedId, 0)
}

SSB.syncFeedFromSequence = function(feedId, sequence, cb) {
  SSB.connected((rpc) => {
    var seqStart = sequence - 100
    if (seqStart < 0)
      seqStart = 0

    console.log(`seq ${seqStart} feedId: ${feedId}`)
    console.time("downloading messages")

    pull(
      rpc.partialReplication.getFeed({ id: feedId, seq: seqStart, keys: false }),
      pull.asyncMap(SSB.db.validateAndAddOOO),
      pull.collect((err, msgs) => {
        if (err) throw err

        console.timeEnd("downloading messages")
        console.log(msgs.length)
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
      rpc.partialReplication.getFeedReverse({ id: feedId, keys: false, limit: 25 }),
      pull.asyncMap(SSB.db.validateAndAddOOO),
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

syncThread = function(messages, cb) {
  pull(
    pull.values(messages),
    pull.filter((msg) => msg && msg.content.type == "post"),
    pull.asyncMap(SSB.db.validateAndAddOOO),
    pull.collect(cb)
  )
}

// this uses https://github.com/arj03/ssb-partial-replication
SSB.getThread = function(msgId, cb)
{
  SSB.connected((rpc) => {
    rpc.partialReplication.getTangle(msgId, (err, messages) => {
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
