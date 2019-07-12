exports.init = function(dir, db, app) {
  const pull = require('pull-stream')
  const path = require('path')

  const onboard = require("./onboard.json")

  function updateDBStatus() {
    setTimeout(() => {
      const status = db.getStatus()
      document.getElementById("status").innerHTML = "<b>DB status</b><br><pre>" + JSON.stringify(status, null, 2) + "</pre>"
      updateDBStatus()
    }, 1000)
  }

  updateDBStatus()

  window.removeDB = function() {
    const createFile = require('random-access-chrome-file')
    const file = createFile(path.join(dir, 'log.offset'))
    file.open((err, done) => {
      file.destroy()
    })

    console.log("remember to delete indexdb indexes as well!")
  }

  window.renderMessages = function() {
    const md = require("ssb-markdown")

    pull(
      db.query.read({
	reverse: true,
	limit: 10,
	query: [
	  {
	    $filter: {
	      value: {
		timestamp: { $gt: 0 },
		content: { type: 'post' }
	      }
	    }
	  }
	]
      }),
      pull.collect((err, msgs) => {
	var html = "<b>Last 10 messages</b><br><br>"
	msgs.forEach((msg) => {
	  html += onboard[msg.value.author].name + " posted " + md.block(msg.value.content.text) + " <br>"
	})

	document.getElementById("messages").innerHTML = html
      })
    )
  }

  window.initialSync = function()
  {
    const remoteAddress = "ws:localhost:8989~shs:6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
    app.connect(remoteAddress, (err, rpc) => {
      if (err) throw(err)

      console.log("connected to: ", rpc.id)

      var d = new Date()
      var onemonthsago = d.setMonth(d.getMonth() - 1)

      var totalMessages = 0
      console.time("downloading messages")

      function getMessagesForUser(index)
      {
	if (index >= Object.keys(onboard).length) {
	  console.log(totalMessages)
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

	console.log("Downloading messages for: ", onboard[user].name)

	pull(
	  rpc.createHistoryStream({id: user, seq: seqStart, keys: false}),
	  pull.drain((msg) => {
	    ++totalMessages
	    db.add(msg, (err, resp) => {
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
}
