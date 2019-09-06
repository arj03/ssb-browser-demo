(function() {
  const pull = require('pull-stream')
  const paramap = require('pull-paramap')
  const human = require('human-time')

  const nodeEmoji = require('node-emoji')
  const md = require("ssb-markdown")
  const ref = require("ssb-ref")

  const mdOpts = {
    toUrl: (id) => {
      var link = ref.parseLink(id)
      if (link && ref.isBlob(link.link))
      {
        if (link.query && link.query.unbox) // private
        {
          // FIXME: doesn't work the first time
          SSB.net.blobs.privateGet(link.link, link.query.unbox, () => {})
          return '' //SSB.net.blobs.fsURL(link.link)
        }
        else
          return SSB.net.blobs.remoteURL(link.link)
      }
      else
        return id
    },
    emoji: (emoji) => {
      // https://github.com/omnidan/node-emoji/issues/76
      const emojiCharacter = nodeEmoji.get(emoji).replace(/:/g, '')
      return `<span class="Emoji">${emojiCharacter}</span>`
    }
  }

  var screen = 'public'
  var lastStatus = null
  var abortablePullStream = null

  function renderMessage(msg, cb)
  {
    var html = "<div style=\"display: table;\">"

    function render(user)
    {
      html += "<span style=\"vertical-align: top; display: table-cell;\">"
      html += "<div style=\"font-size: small; margin-bottom: 5px;\" title=\"" + new Date(msg.value.timestamp).toLocaleString("da-DK") + "\">" + human(new Date(msg.value.timestamp)) + "</div>"
      if (user)
        html += "<a href=\"" + msg.value.author + "\" target=\"_blank\">" + user.name + "</a> posted"

      if (msg.value.content.root && msg.value.content.root != msg.key)
        html += " in reply <a href=\"" + msg.value.content.root + "\" target=\"_blank\">to</a>"
      else
        html += " a <a href=\"" + msg.key + "\" target=\"_blank\">thread</a>"

      html += "</span></div>"

      if (msg.value.content.subject) // private
        html += "<h2><a href='" +  msg.key + "'>" + msg.value.content.subject + "</a></h2>"

      html += md.block(msg.value.content.text, mdOpts) + " <br>"

      cb(null, html)
    }

    let user = { author: msg.value.author, name: msg.value.author }
    if (SSB.profiles)
      user = SSB.profiles[msg.value.author]
    if (user && user.image) {
      SSB.net.blobs.localGet(user.image, (err, url) => {
        if (!err)
          html += "<img style='width: 50px; height; 50px; padding-right: 10px; display: table-cell;' src='" + url + "' />"

        render(user)
      })
    }
    else
    {
      render(user)
    }
  }

  /*
  window.totalMessages = function() {
    pull(
      SSB.db.query.read(),
      pull.collect((err, msgs) => {
        console.log("err", err)
        console.log(msgs)
      })
    )
  }
  */

  function renderMessages(onlyThreads, messages) {
    var html = "<h2 style=\"margin-bottom: 5px\">Last 50 messages</h2>"
    html += "Threads only: <input id=\"onlyThreads\" type=\"checkbox\""
    if (onlyThreads)
      html += " checked><br><br>"
    else
      html += "><br><br>"

    pull(
      pull.values(messages),
      paramap(renderMessage, 1),
      pull.collect((err, rendered) => {
        document.getElementById("messages").innerHTML = html + rendered.join('')

        document.getElementById("onlyThreads").addEventListener("click", function(ev) {
          renderPublic(ev.target.checked)
        })

        document.getElementById("top").innerHTML = `
              <textarea id="message" style="height: 10rem; width: 40rem; padding: 5px;"></textarea><br>
              <input type="file" id="file">
              <input type="submit" id="postMessage" style="margin-top: 5px" value="Post new thread" />`

        document.getElementById("bottom").innerHTML = ""

        document.getElementById("file").addEventListener("change", function(ev) {
          const file = ev.target.files[0]

          if (!file) return

          file.arrayBuffer().then(function (buffer) {
            SSB.net.blobs.hash(new Uint8Array(buffer), (err, digest) => {
              SSB.net.blobs.add("&" + digest, file, (err) => {
                if (!err) {
                  SSB.net.blobs.push("&" + digest, (err) => {
                    document.getElementById("message").value += " ![" + file.name + "](&" + digest + ")"
                  })
                }
              })
            })
          })
        })

        document.getElementById("postMessage").addEventListener("click", function() {
          var text = document.getElementById("message").value
          if (text != '')
          {
            SSB.state.queue = []
            var state = SSB.generateMessage(SSB.state, null, SSB.net.config.keys, { type: 'post', text }, Date.now())
            console.log(state.queue[0])
            SSB.db.add(state.queue[0].value, (err, data) => {
              console.log(err)
              console.log(data)

              SSB.db.last.update(data.value)

              renderPublic()
            })
          }
        })
      })
    )
  }

  function renderPublic(onlyThreads) {
    if (lastStatus && lastStatus.since == 0) // empty db
      return renderMessages(onlyThreads, [])

    let contentFilter = { type: 'post' }
    if (onlyThreads)
      contentFilter["root"] = undefined

    pull(
      SSB.db.query.read({
        reverse: true,
        limit: 50,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              //author: '@VIOn+8a/vaQvv/Ew3+KriCngyUXHxHbjXkj4GafBAY0=.ed25519'
              content: contentFilter
            }
          }
        }]
      }),
      pull.filter((msg) => !msg.value.meta),
      pull.collect((err, msgs) => {
        if (screen == 'public') // query might be delayed
          renderMessages(onlyThreads, msgs)
      })
    )
  }

  function renderPrivateMessages(messages) {
    var html = "<h2>Private messages</h2>"

    pull(
      pull.values(messages),
      pull.filter((msg) => !msg.value.content.root), // top posts
      paramap(renderMessage, 1),
      pull.collect((err, rendered) => {
        document.getElementById("top").innerHTML = `
              <input type="text" id="recipients" style="padding: 5px; width: 40rem; margin: 10 0 10 0px" placeholder="recipient ids (, seperator)" />
              <input type="text" id="subject" style="padding: 5px; width: 40rem; margin: 0 0 10 0px" placeholder="subject" />
              <textarea id="message" style="height: 10rem; width: 40rem; padding: 5px"></textarea><br>
              <input type="submit" id="postPrivateMessage" style="margin-top: 5px" value="Post private message" />`
        document.getElementById("postPrivateMessage").addEventListener("click", function() {
          var text = document.getElementById("message").value
          var subject = document.getElementById("subject").value
          var recipients = document.getElementById("recipients").value.split(',').map(x => x.trim())

          if (!recipients.every(x => x.startsWith("@")))
          {
            alert("recipients must start with @")
            return
          }

          if (!recipients.includes(SSB.net.id))
            recipients.push(SSB.net.id)

          if (text != '' && subject != '')
          {
            var content = { type: 'post', text, subject }
            if (recipients) {
              content.recps = recipients
              content = SSB.box(content, recipients.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
            }

            SSB.state.queue = []
            var state = SSB.generateMessage(SSB.state, null, SSB.net.config.keys, content, Date.now())
            console.log(state.queue[0])

            SSB.db.add(state.queue[0].value, (err, data) => {
              console.log(err)
              console.log(data)
              SSB.db.last.update(data.value)

              renderPrivate()
            })
          }
        })

        document.getElementById("messages").innerHTML = html + rendered.join('')
        document.getElementById("bottom").innerHTML = ''
      })
    )
  }

  function renderPrivate() {
    if (lastStatus && lastStatus.since == 0) // empty db
      return renderPrivateMessages([])

    pull(
      SSB.db.query.read({
        reverse: true,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              content: { recps: { $truthy: true } }
            }
          }
        }]
      }),
      pull.collect((err, msgs) => {
        renderPrivateMessages(msgs)
      })
    )
  }

  function renderChat() {
    document.getElementById("top").innerHTML = "<div style='margin-bottom: 10px'>Your id: " + SSB.net.id + `</div>
              <button id="acceptConnections" style="padding: 5px; margin-right: 1rem;">Accept incoming connections</button>   or  
              <input type="text" id="tunnelConnect" style="padding: 5px; width: 24rem; margin-bottom: 12px; margin-left: 1rem;" placeholder="@remoteId to connect to" />
              <input type="text" id="chatMessage" style="padding: 5px; width: 40rem;" placeholder="type message, enter to send" />
              `

    document.getElementById("acceptConnections").addEventListener("click", function() {
      SSB.net.tunnelChat.acceptMessages()
    })

    document.getElementById("tunnelConnect").addEventListener('keydown', function(e) {
      var text = document.getElementById("tunnelConnect").value
      if (e.keyCode == 13 && text != '') { // enter
        SSB.net.tunnelChat.connect(text.trim())
      }
    })

    document.getElementById("chatMessage").addEventListener('keydown', function(e) {
      var text = document.getElementById("chatMessage").value
      if (e.keyCode == 13 && text != '') { // enter
        SSB.net.tunnelChat.sendMessage(text)
        document.getElementById("chatMessage").value = ''
      }
    })

    document.getElementById("messages").innerHTML = '<h2>Off-chain messages</h2>' +
      '<div style="font-size: smaller; margin-bottom: 10px; margin-top: -10px;">Off-chain messages are messages sent encrypted between you and the other end through the magic of tunnels. These messages are ephemeral and will be gone forever when you change view!</div>'

    abortablePullStream = pullAbort()
    pull(
      SSB.net.tunnelChat.messages(),
      abortablePullStream,
      pull.drain((msg) => {
        document.getElementById("messages").innerHTML += msg.user + "> " + msg.text + "<br>"
      })
    )
  }

  function addReply(rootId, lastMsgId, recps) {
    document.getElementById("bottom").innerHTML = `
      <textarea id="message" style="height: 10rem; width: 40rem;"></textarea><br>
      <input type="submit" id="postReply" style="margin-top: 5px" value="Post reply" />`

    document.getElementById("postReply").addEventListener("click", function() {
      var text = document.getElementById("message").value
      if (text != '')
      {
        var content = { type: 'post', text, root: rootId, branch: lastMsgId }
        if (recps) {
          content.recps = recps
          content = SSB.box(content, recps.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        SSB.state.queue = []
        var state = SSB.generateMessage(SSB.state, null, SSB.net.config.keys, content, Date.now())
        var msg = state.queue[0].value

        SSB.db.add(msg, (err, data) => {
          if (!err)
            state.queue = []

          console.log(err)
          console.log(data)
          SSB.db.last.update(data.value)

          renderThread(rootId)
        })
      }
    })
  }

  function renderThread(rootId) {
    function render(rootMsg)
    {
      var html = "<h2>Thread " + rootId + "</h2>"
      var lastMsgId = rootId

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
          pull.through((msg) => lastMsgId = msg.key),
          paramap(renderMessage, 1),
          pull.collect((err, rendered) => {
            document.getElementById("top").innerHTML = ''
            document.getElementById("messages").innerHTML = html + rootMsgHTML + rendered.join('')
            addReply(rootId, lastMsgId, rootMsg.content.recps)
            window.scrollTo(0, 0)
          })
        )
      })
    }

    SSB.db.get(rootId, (err, rootMsg) => {
      if (err) { // FIXME: make this configurable
        SSB.getThread(rootId, (err) => {
          if (err) console.error(err)

          SSB.db.get(rootId, (err, rootMsg) => {
            if (err) {
              console.error(err)
              render({ content: { text: 'Unknown message type' }})
            } else
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
        limit: 50,
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
        if (SSB.profiles && SSB.profiles[author])
          name = SSB.profiles[author].name

        var html = "<h2>Last 50 messages for " + name + " <div style=\"font-size: 15px\">(" + author + ")</div></h2>"

        pull(
          pull.values(msgs),
          paramap(renderMessage, 1),
          pull.collect((err, rendered) => {
            document.getElementById("messages").innerHTML = html + rendered.join('')
            window.scrollTo(0, 0)
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

      if (!SSB.remoteAddress)
        SSB.remoteAddress = document.getElementById("remoteAddress").value

      if (!SSB.onboard)
        loadOnboardBlob()

      if (!SSB.profiles) {
        SSB.loadProfiles()
        if (screen == 'public')
          renderPublic()
      }

      const status = SSB.db.getStatus()

      if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
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
      }

      statusHTML += "<br><pre>" + JSON.stringify(status, null, 2) + "</pre>"

      document.getElementById("status").innerHTML = statusHTML

      updateDBStatus()
    }, 1000)
  }

  updateDBStatus()

  function loadOnboardBlob()
  {
    var text = document.getElementById("blobId").value
    if (text != '' && typeof SSB !== 'undefined')
    {
      SSB.net.blobs.remoteGet(text, "text", (err, data) => {
        if (err) return console.error(err)

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

  document.getElementById("threadId").addEventListener('keydown', function(e) {
    if (e.keyCode == 13) // enter
    {
      var msgId = document.getElementById("threadId").value
      if (msgId != '') {
        screen = 'thread'
        SSB.renderThread(msgId)
      }
    }
  })

  function changeScreen(ev, name)
  {
    ev.stopPropagation()
    ev.preventDefault()

    if (name == 'settings')
      document.getElementById("settings").style=""
    else
      document.getElementById("settings").style="display:none"

    if (abortablePullStream != null) {
      abortablePullStream.abort()
      abortablePullStream = null
    }

    screen = name
  }

  document.getElementById("goToPublic").addEventListener("click", function(ev) {
    changeScreen(ev, 'public')
    renderPublic()
  })

  document.getElementById("goToPrivate").addEventListener("click", function(ev) {
    changeScreen(ev, 'private')
    renderPrivate()
  })

  document.getElementById("goToChat").addEventListener("click", function(ev) {
    changeScreen(ev, 'chat')
    renderChat()
  })

  document.getElementById("goToSettings").addEventListener("click", function(ev) {
    changeScreen(ev, 'settings')

    document.getElementById("top").innerHTML = ''
    document.getElementById("messages").innerHTML = ''
    document.getElementById("bottom").innerHTML = ''
  })

  document.getElementById("syncData").addEventListener("click", function(ev) {
    if (SSB.db.getStatus().since <= 0) {
      if (!SSB.onboard) {
        alert("Must provide onboard blob url first")
        return
      }

      SSB.initialSync()
      alert("Initial load can take a while")
    } else
      SSB.sync()
  })

})()
