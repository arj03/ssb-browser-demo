const validate = require('ssb-validate')
const keys = require('ssb-keys')
const pull = require('pull-stream')
const raf = require('polyraf')

var remote

function connected(cb)
{
  if (!remote || remote.closed)
  {
    SSB.isInitialSync = false // for ssb-ebt
    SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
      if (err) throw(err)

      remote = rpc
      cb(remote)
    })
  } else
    cb(remote)
}

exports.removeDB = function() {
  const path = require('path')

  const file = raf(path.join(SSB.dir, 'log.offset'))
  file.open((err, done) => {
    if (err) return console.error(err)
    file.destroy()
  })

  localStorage['last.json'] = JSON.stringify({})

  console.log("remember to delete indexdb indexes as well!")
}

exports.removeBlobs = function() {
  function listDir(fs, path)
  {
    fs.root.getDirectory(path, {}, function(dirEntry) {
      var dirReader = dirEntry.createReader()
      dirReader.readEntries(function(entries) {
	for(var i = 0; i < entries.length; i++) {
	  var entry = entries[i]
	  if (entry.isDirectory) {
	    //console.log('Directory: ' + entry.fullPath);
	    listDir(fs, entry.fullPath)
	  }
	  else if (entry.isFile) {
            console.log('deleting file: ' + entry.fullPath)
            const file = raf(entry.fullPath)
            file.open((err, done) => {
              if (err) return console.error(err)
              file.destroy()
            })
          }
	}
      })
    })
  }

  window.webkitRequestFileSystem(window.PERSISTENT, 0, function (fs) {
    listDir(fs, '/.ssb-lite/blobs')
  })
}

// this uses https://github.com/arj03/ssb-get-thread plugin
exports.getThread = function(msgId, cb)
{
  connected((rpc) => {
    rpc.getThread.get(msgId, (err, messages) => {
      if (err) return cb(err)

      exports.syncThread(messages, cb)
    })
  })
}

exports.syncThread = function(messages, cb) {
  const hmac_key = null

  pull(
    pull.values(messages),
    pull.filter((msg) => msg && msg.content.type == "post"),
    pull.drain((msg) => {
      state = validate.appendOOO(SSB.state, hmac_key, msg)

      if (SSB.state.error)
        throw SSB.state.error

      SSB.db.add(msg, (err) => {
        if (err)
          console.log("err ", err)
      })
    }, cb)
  )
}

exports.sync = function()
{
  connected((rpc) => {
    if (!SSB.state.feeds[SSB.net.id])
      SSB.net.ebt.request(SSB.net.id, true)

    if (localStorage["settings"] && JSON.parse(localStorage["settings"]).syncOnlyFollows) {
      SSB.db.friends.hops((err, hops) => {
        for (var feed in hops)
          if (hops[feed] == 1)
            SSB.net.ebt.request(feed, true)
      })
    } else {
      for (var feed in SSB.state.feeds)
        SSB.net.ebt.request(feed, true)
    }
  })
}

exports.writeProfiles = function()
{
  let cleaned = {}
  for (var key in SSB.onboard) {
    cleaned[key] = {
      image: SSB.onboard[key].image,
      name: SSB.onboard[key].name,
      description: SSB.onboard[key].description
    }
  }
  localStorage['profiles.json'] = JSON.stringify(cleaned)
}

exports.loadProfiles = function() {
  if (localStorage['profiles.json'])
    SSB.profiles = JSON.parse(localStorage['profiles.json'])
}

// this uses https://github.com/arj03/ssb-partial-replication
exports.syncFeedAfterFollow = function(feedId) {
  connected((rpc) => {
    delete SSB.state.feeds[feedId]
    SSB.db.last.setPartialLogState(feedId, false)

    var seqStart = SSB.db.last.get()[feedId].sequence - 100
    if (seqStart < 0)
      seqStart = 0

    console.time("downloading messages")

    pull(
      rpc.partialReplication.partialReplication({id: feedId, seq: seqStart, keys: false}),
      pull.drain((msg) => {
        SSB.net.add(msg, (err, res) => {})
      }, (err) => {
        if (err) throw err

        console.timeEnd("downloading messages")
        SSB.state.queue = []
      })
    )
  })
}

exports.initialSync = function()
{
  const onboard = SSB.onboard

  SSB.isInitialSync = true // for ssb-ebt
  SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
    if (err) throw(err)

    var d = new Date()
    var onemonthsago = d.setMonth(d.getMonth() - 1)

    var totalMessages = 0
    var totalFilteredMessages = 0
    var totalPrivateMessages = 0
    var totalFeeds = 0

    console.time("downloading messages")

    function getMessagesForUser(index)
    {
      if (index >= Object.keys(onboard).length) {
        console.log("feeds", totalFeeds)
        console.log("messages", totalMessages)
        console.log("filtered", totalFilteredMessages)
        console.timeEnd("downloading messages")

        SSB.isInitialSync = false
        exports.writeProfiles()

        return
      }

      var user = Object.keys(onboard)[index]

      // FIXME: filter out in script
      if (onboard[user].latestMsg == null) {
        getMessagesForUser(index+1)
        return
      }

      if (onboard[user].latestMsg.timestamp < onemonthsago) {
        //console.log("skipping older posts for", onboard[user].name)
        getMessagesForUser(index+1)
        return
      }

      var seqStart = onboard[user].latestMsg.seq - 25
      if (seqStart < 0)
        seqStart = 0

      if (user == SSB.net.id) // always all
        seqStart = 0
      else
        SSB.db.last.setPartialLogState(user, true)

      ++totalFeeds

      //console.log("Downloading messages for: ", onboard[user].name)

      pull(
        rpc.partialReplication.partialReplication({id: user, seq: seqStart, keys: false}),
        pull.drain((msg) => {
          ++totalMessages
          SSB.net.add(msg, (err, res) => {
            if (res)
              ++totalFilteredMessages
          })
        }, (err) => {
          if (err) throw err

          SSB.state.queue = []

          getMessagesForUser(index+1)
        })
      )
    }

    getMessagesForUser(0)
  })
}
