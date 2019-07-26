exports.removeDB = function() {
  const createFile = require('random-access-chrome-file')
  const path = require('path')

  const file = createFile(path.join(SSB.dir, 'log.offset'))
  file.open((err, done) => {
    file.destroy()
  })

  console.log("remember to delete indexdb indexes as well!")
}

exports.sync = function()
{
  const pull = require('pull-stream')
  const validate = require('ssb-validate')

  const remoteAddress = "ws:localhost:8989~shs:6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
  SSB.net.connect(remoteAddress, (err, rpc) => {
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

	  if (typeof (msg.content) === 'string' || msg.content.type != 'post')
	    return

	  ++totalFilteredMessages

	  SSB.db.add(msg, (err, resp) => {
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
  const pull = require('pull-stream')
  const onboard = SSB.onboard

  const remoteAddress = "ws:localhost:8989~shs:6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
  SSB.net.connect(remoteAddress, (err, rpc) => {
    if (err) throw(err)

    console.log("connected to: ", rpc.id)

    var d = new Date()
    var onemonthsago = d.setMonth(d.getMonth() - 1)

    var totalMessages = 0
    var totalFilteredMessages = 0
    var totalFeeds = 0

    console.time("downloading messages")

    const validate = require('ssb-validate')
    const hmac_key = null
    var state = validate.initial()

    function getMessagesForUser(index)
    {
      if (index >= Object.keys(onboard).length) {
	console.log("messages", totalMessages)
	console.log("posts", totalFilteredMessages)
	console.log("feeds", totalFeeds)
	console.timeEnd("downloading messages")
	return
      }

      var user = Object.keys(onboard)[index]

      // FIXME: filter out in script
      if (onboard[user].latestMsg == null) {
	getMessagesForUser(index+1)
	return
      }

      if (onboard[user].latestMsg.timestamp < onemonthsago) {
	console.log("skipping older posts for", onboard[user].name)
	getMessagesForUser(index+1)
	return
      }

      var seqStart = onboard[user].latestMsg.seq - 25
      if (seqStart < 0)
	seqStart = 0

      ++totalFeeds

      console.log("Downloading messages for: ", onboard[user].name)

      pull(
	rpc.createHistoryStream({id: user, seq: seqStart, keys: false}),
	pull.drain((msg) => {
	  if (msg.sequence == seqStart)
	    state = validate.appendOOO(state, hmac_key, msg)
	  else
	    state = validate.append(state, hmac_key, msg)

	  if (state.error)
	    throw state.error

	  ++totalMessages

	  if (typeof (msg.content) === 'string' || msg.content.type != 'post')
	    return

	  ++totalFilteredMessages

	  SSB.db.add(msg, (err, resp) => {
	    if (err)
	      console.log("err ", err)
	    //console.log("added ", msg)
	  })
	}, (err) => {
	  if (err) throw err

	  state.queue = []

	  getMessagesForUser(index+1)
	})
      )
    }

    getMessagesForUser(0)
  })
}
