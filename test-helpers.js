exports.init = function(dir, db, app) {
  const pull = require('pull-stream')
  const path = require('path')

  const onboard = require("./onboard.json")

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
	var html = ""
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

      var d = new Date();
      var onemonthsago = d.setMonth(d.getMonth() - 1);

      function getMessagesForUser(index)
      {
	if (index >= Object.keys(onboard).length)
	  return

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

	var last50 = onboard[user].latestMsg.seq - 50
	if (last50 < 0)
	  last50 = 0

	console.log("Downloading messages for: ", onboard[user].name)

	pull(
	  rpc.createHistoryStream({id: user, seq: last50, keys: false}),
	  pull.drain((msg) => {
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
