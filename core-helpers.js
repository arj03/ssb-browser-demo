const validate = require('ssb-validate')
const keys = require('ssb-keys')
const pull = require('pull-stream')

const hmac_key = null

exports.removeDB = function() {
  const createFile = require('random-access-chrome-file')
  const path = require('path')

  const file = createFile(path.join(SSB.dir, 'log.offset'))
  file.open((err, done) => {
    file.destroy()
  })

  console.log("remember to delete indexdb indexes as well!")
}

// this uses the https://github.com/arj03/ssb-get-thread plugin
exports.getThread = function(msgId, cb)
{
  SSB.isInitialSync = false // for ssb-ebt
  SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
    if (err) return cb(err)

    rpc.getThread.get(msgId, (err, messages) => {
      if (err) return cb(err)

      exports.syncThread(messages, cb)
    })
  })
}

exports.syncThread = function(messages, cb) {
  pull(
    pull.values(messages),
    pull.filter((msg) => msg.content.type == "post"),
    pull.drain((msg) => {
      state = validate.appendOOO(SSB.state, hmac_key, msg)

      if (SSB.state.error)
	throw SSB.state.error

      SSB.db.add(msg, (err) => {
	if (err)
	  console.log("err ", err)
	//console.log("added ", msg)
      })
    }, cb)
  )
}

exports.decryptMessage = function(msg) {
  return keys.unbox(msg.content, SSB.net.config.keys.private)
}

// FIXME: this is a mess, will be replaced with ssb-conn & ssb-ebt instead
exports.sync = function()
{
  SSB.isInitialSync = false // for ssb-ebt
  SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
    if (err) throw(err)

    // replicate our own feed
    SSB.net.ebt.request(SSB.net.id, true)

    console.log("connected to: ", rpc.id)

    var totalMessages = 0
    var totalFilteredMessages = 0
    var totalFeeds = 0

    console.time("downloading messages")

    function getMessagesForUser(index)
    {
      if (index >= Object.keys(SSB.state.feeds).length) {
	console.log("messages", totalMessages)
	console.log("posts", totalFilteredMessages)
	console.log("feeds", totalFeeds)
	console.timeEnd("downloading messages")
	return
      }

      var user = Object.keys(SSB.state.feeds)[index]
      var seq = SSB.state.feeds[user].sequence + 1

      pull(
	rpc.createHistoryStream({id: user, seq, keys: false}),
	pull.drain((msg) => {
	  SSB.state = validate.append(SSB.state, null, msg)

	  if (SSB.state.error)
	    throw SSB.state.error

	  ++totalMessages

	  var isPrivate = (typeof (msg.content) === 'string')

	  if (isPrivate && !SSB.privateMessages)
	    return
	  else if (!isPrivate && !SSB.validMessageTypes.includes(msg.content.type))
	    return

	  if (isPrivate)
	  {
            var decrypted = exports.decryptMessage(msg)
            if (!decrypted) // not for us
              return
	  }

	  ++totalFilteredMessages

	  SSB.db.add(msg, (err) => {
	    if (err)
	      console.log("err ", err)
	    //console.log("added ", msg)
	  })
	}, (err) => {
	  if (err) throw err

	  getMessagesForUser(index+1)
	})
      )
    }

    getMessagesForUser(0)
  })
}

exports.initialSync = function()
{
  const onboard = SSB.onboard

  SSB.isInitialSync = true // for ssb-ebt
  SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
    if (err) throw(err)

    console.log("connected to: ", rpc.id)

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
	console.log("private", totalPrivateMessages)
	console.log("filtered", totalFilteredMessages)
	console.timeEnd("downloading messages")
	SSB.isInitialSync = false
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

      ++totalFeeds

      //console.log("Downloading messages for: ", onboard[user].name)

      pull(
	rpc.createHistoryStream({id: user, seq: seqStart, keys: false}),
	pull.drain((msg) => {
	  if (msg.sequence == seqStart)
	    SSB.state = validate.appendOOO(SSB.state, hmac_key, msg)
	  else
	    SSB.state = validate.append(SSB.state, hmac_key, msg)

	  if (SSB.state.error)
	    throw SSB.state.error

	  ++totalMessages

	  var isPrivate = (typeof (msg.content) === 'string')

	  if (isPrivate && !SSB.privateMessages)
	    return
	  else if (!isPrivate && !SSB.validMessageTypes.includes(msg.content.type))
	    return

	  if (isPrivate)
	  {
	    ++totalPrivateMessages

            var decrypted = exports.decryptMessage(msg)
            if (!decrypted) // not for us
              return
	  }

	  ++totalFilteredMessages

	  SSB.db.add(msg, (err) => {
	    if (err)
	      console.log("err ", err)
	    //console.log("added ", msg)
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
