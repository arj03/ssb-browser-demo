(function() {
  const pull = require('pull-stream')
  const paramap = require('pull-paramap')
  const path = require('path')

  var rendered = false
  var lastStatus = null

  function renderMessages() {
    const md = require("ssb-markdown")
    const ref = require("ssb-ref")

    const mdOpts = {
      toUrl: (id) => {
	if (ref.isBlob(id))
	  return SSB.net.blobs.remoteURL(id)
	else
	  return id
      }
    }

    pull(
      SSB.db.query.read({
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
	pull(
	  pull.values(msgs),
	  paramap((msg, cb) => {
	    if (SSB.onboard[msg.value.author].image) {
	      SSB.net.blobs.get(SSB.onboard[msg.value.author].image, (err, url) => {
		html += "<img style='width: 50px; height; 50px; padding-right: 5px;' src='" + url + "' />"
		html += SSB.onboard[msg.value.author].name + " posted " + md.block(msg.value.content.text, mdOpts) + " <br>"
		cb()
	      })
	    }
	    else
	    {
	      html += SSB.onboard[msg.value.author].name + " posted " + md.block(msg.value.content.text, mdOpts) + " <br>"
	      cb()
	    }
	  }, 1),
	  pull.collect(() => {
	    document.getElementById("messages").innerHTML = html
	  })
	)
      })
    )
  }

  function updateDBStatus() {
    setTimeout(() => {
      if (SSB === undefined) {
	updateDBStatus()
	return
      }

      if (!SSB.onboard)
	SSB.onboard = require("./onboard.json")
      
      const status = SSB.db.getStatus()

      if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
	updateDBStatus()
	return
      }

      lastStatus = status

      var statusHTML = "<b>DB status</b>"
      if (status.since == 0) // sleeping
	statusHTML += "<img style=\"float: right;\" src=\"http://localhost:8989/blobs/get/&FT0Klmzl45VThvWQIuIhmGwPoQISP+tZTduu/5frHk4=.sha256\"/>"
      else if (!status.sync) // hammer time
	statusHTML += "<img style=\"float: right;\" src=\"http://localhost:8989/blobs/get/&IGPNvaqpAuE9Hiquz7VNFd3YooSrEJNofoxUjRMSwww=.sha256\"/>"
      else { // dancing
	statusHTML += "<img style=\"float: right;\" src=\"http://localhost:8989/blobs/get/&utxo7ToSNDhHpXpgrEhJo46gwht7PBG3nIgzlUTMmgU=.sha256\"/>"
	if (!rendered) {
	  renderMessages()
	  rendered = true
	}
      }

      statusHTML += "<br><pre>" + JSON.stringify(status, null, 2) + "</pre>"

      document.getElementById("status").innerHTML = statusHTML

      updateDBStatus()
    }, 1000)
  }

  updateDBStatus()

})()
