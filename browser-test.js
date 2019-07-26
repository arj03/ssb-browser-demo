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
		//author: '@VIOn+8a/vaQvv/Ew3+KriCngyUXHxHbjXkj4GafBAY0=.ed25519'
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
	    const onboardingUser = SSB.onboard[msg.value.author]
	    if (onboardingUser && onboardingUser.image) {
	      SSB.net.blobs.get(onboardingUser.image, (err, url) => {
		html += "<img style='width: 50px; height; 50px; padding-right: 5px;' src='" + url + "' />"
		if (onboardingUser)
		  html += onboardingUser.name + " posted "
		html += md.block(msg.value.content.text, mdOpts) + " <br>"
		cb()
	      })
	    }
	    else
	    {
	      if (onboardingUser)
		html += onboardingUser.name + " posted "
	      html += md.block(msg.value.content.text, mdOpts) + " <br>"
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
      if (typeof SSB === 'undefined') {
	updateDBStatus()
	return
      }

      const status = SSB.db.getStatus()

      if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
	if (!rendered && SSB.onboard) {
	  renderMessages()
	  rendered = true
	}
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
	if (!rendered && SSB.onboard) {
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

  document.getElementById("postMessage").addEventListener("click", function(){
    var text = document.getElementById("message").value
    if (text != '')
    {
      var state = SSB.appendNewMessage(SSB.state, null, SSB.net.config.keys, { type: 'post', text }, Date.now())
      console.log(state.queue[0])
      SSB.db.add(state.queue[0].value, (err, data) => {
	console.log(err)
	console.log(data)
      })
    }
  })

  document.getElementById("useBlobId").addEventListener("click", function(){
    var text = document.getElementById("blobId").value
    if (text != '')
    {
      SSB.net.blobs.remoteGet(text, (err, data) => {
	SSB.onboard = JSON.parse(data)
	alert("Loaded onboarding blob")
      })
    }
  })

})()
