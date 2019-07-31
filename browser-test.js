(function() {
  const pull = require('pull-stream')
  const paramap = require('pull-paramap')
  const path = require('path')

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

  var rendered = false
  var lastStatus = null

  function renderMessage(msg, cb)
  {
    var html = ""

    function render(onboardUser)
    {
      if (onboardingUser)
	html += "<a href=\"" + msg.value.author + "\" target=\"_blank\">" + onboardingUser.name + "</a> posted:"

      if (msg.value.content.root && msg.value.content.root != msg.key)
	html += " in reply <a href=\"" + msg.value.content.root + "\" target=\"_blank\">to</a>"

      html += md.block(msg.value.content.text, mdOpts) + " <br>"

      cb(null, html)
    }

    const onboardingUser = SSB.onboard[msg.value.author]
    if (onboardingUser && onboardingUser.image) {
      SSB.net.blobs.get(onboardingUser.image, (err, url) => {
	if (!err)
	  html += "<img style='width: 50px; height; 50px; padding-right: 5px;' src='" + url + "' />"

	render(onboardingUser)
      })
    }
    else
    {
      render(onboardingUser)
    }
  }

  function renderMessages() {
    pull(
      SSB.db.query.read({
	reverse: true,
	limit: 10,
	query: [{
	  $filter: {
	    value: {
	      timestamp: { $gt: 0 },
	      //author: '@VIOn+8a/vaQvv/Ew3+KriCngyUXHxHbjXkj4GafBAY0=.ed25519'
	      content: { type: 'post' }
	    }
	  }
	}]
      }),
      pull.collect((err, msgs) => {
	var html = "<b>Last 10 messages</b><br><br>"

	pull(
	  pull.values(msgs),
	  paramap(renderMessage, 1),
	  pull.collect((err, rendered) => {
	    document.getElementById("messages").innerHTML = html + rendered.join('')
	  })
	)
      })
    )
  }

  function renderThread(rootId) {
    function render(rootMsg)
    {
      var html = "<b>Thread " + rootId + "</b><br><br>"

      renderMessage({ value: rootMsg }, (err, rootMsgHTML) => {
	pull(
	  SSB.db.query.read({
	    query: [{
	      $filter: {
		value: {
		  content: { root: rootId },
		}
	      }
	    }]
	  }),
	  paramap(renderMessage, 1),
	  pull.collect((err, rendered) => {
	    document.getElementById("messages").innerHTML = html + rootMsgHTML + rendered.join('')
	    window.scrollTo(0, 450)
	  })
	)
      })
    }

    SSB.db.get(rootId, (err, rootMsg) => {
      if (err) {
	SSB.getThread(rootId, (err) => {
	  if (err) return console.error(err)

	  SSB.db.get(rootId, (err, rootMsg) => {
	    if (err) return console.error(err)

	    render(rootMsg)
	  })
	})
      } else
	render(rootMsg)
    })
  }

  function renderProfile(author) {
    pull(
      SSB.db.query.read({
	reverse: true,
	limit: 10,
	query: [{
	  $filter: {
	    value: {
	      author: author
	    }
	  }
	}]
      }),
      pull.collect((err, msgs) => {
	var name = author
	if (SSB.onboard[author])
	  name = SSB.onboard[author].name

	var html = "<b>Last 10 messages for " + name + "</b><br><br>"

	pull(
	  pull.values(msgs),
	  paramap(renderMessage, 1),
	  pull.collect((err, rendered) => {
	    document.getElementById("messages").innerHTML = html + rendered.join('')
	    window.scrollTo(0, 450)
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

      SSB.renderThread = renderThread

      if (!SSB.onboard)
	loadOnboardBlob()

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
      if (status.since == 0 || status.since == -1) // sleeping
	statusHTML += "<img style=\"float: right;\" src=\"" + SSB.net.blobs.remoteURL('&FT0Klmzl45VThvWQIuIhmGwPoQISP+tZTduu/5frHk4=.sha256') + "\"/>"
      else if (!status.sync) // hammer time
	statusHTML += "<img style=\"float: right;\" src=\"" + SSB.net.blobs.remoteURL('&IGPNvaqpAuE9Hiquz7VNFd3YooSrEJNofoxUjRMSwww=.sha256') + "\"/>"
      else { // dancing
	statusHTML += "<img style=\"float: right;\" src=\"" + SSB.net.blobs.remoteURL('&utxo7ToSNDhHpXpgrEhJo46gwht7PBG3nIgzlUTMmgU=.sha256') + "\"/>"
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

  function loadOnboardBlob()
  {
    var text = document.getElementById("blobId").value
    if (text != '' && typeof SSB !== 'undefined')
    {
      SSB.remoteAddress = document.getElementById("remoteAddress").value

      SSB.net.blobs.remoteGet(text, (err, data) => {
	SSB.onboard = JSON.parse(data)
	console.log("Loaded onboarding blob")
      })
    }
  }

  document.getElementById("remoteAddress").addEventListener('keydown', function(e) {
    if (e.keyCode == 13) // enter
      SSB.remoteAddress = document.getElementById("remoteAddress").value
  })

  document.getElementById("blobId").addEventListener('keydown', function(e) {
    if (e.keyCode == 13) // enter
      loadOnboardBlob()
  })

  document.getElementById("threadId").addEventListener('keydown', function(e) {
    if (e.keyCode == 13) // enter
    {
      var msgId = document.getElementById("threadId").value
      if (msgId != '')
	SSB.renderThread(msgId)
    }
  })

  window.addEventListener('click', (ev) => {
    if (ev.target.tagName === 'A' && ev.target.getAttribute('href').startsWith("%"))
    {
      ev.stopPropagation()
      ev.preventDefault()
      renderThread(ev.target.getAttribute('href'))
    }
    else if (ev.target.tagName === 'A' && ev.target.getAttribute('href').startsWith("@"))
    {
      ev.stopPropagation()
      ev.preventDefault()
      renderProfile(ev.target.getAttribute('href'))
    }
  })

  document.getElementById("header").addEventListener("click", function() {
    renderMessages()
  })

})()
