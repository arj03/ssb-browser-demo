(function() {
  const pull = require('pull-stream')
  const pullAbort = require('pull-abortable')
  const paramap = require('pull-paramap')
  const human = require('human-time')

  const nodeEmoji = require('node-emoji')
  const md = require('ssb-markdown')
  const ref = require('ssb-ref')

  const SSBContactMsg = require('ssb-contact-msg/async/create')

  const mdOpts = {
    toUrl: (id) => {
      var link = ref.parseLink(id)
      if (link && ref.isBlob(link.link))
      {
        if (link.query && link.query.unbox) // private
        {
          // FIXME: doesn't work the first time
          SSB.net.blobs.privateGet(link.link, link.query.unbox, () => {})
          return SSB.net.blobs.privateFsURL(link.link)
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
    var html = "<div class='message'><div class='header'>"

    function render(user)
    {
      var date = new Date(msg.value.timestamp).toLocaleString("da-DK")
      var humandate = human(new Date(msg.value.timestamp))

      html += "<span class='text'>"
      html += `<div class='date' title='${date}'>${humandate}</div>`
      if (user)
        html += `<a href='${msg.value.author}'>${user.name}</a> posted`

      if (msg.value.content.root && msg.value.content.root != msg.key)
        html += ` in reply <a href='${msg.value.content.root}'>to</a>`
      else
        html += ` a <a href='${msg.key}'>thread</a>`

      html += "</span></div>"

      if (msg.value.content.subject) // private
        html += `<h2><a href='${msg.key}'>${msg.value.content.subject}</a></h2>`

      html += md.block(msg.value.content.text, mdOpts)

      html += "</div>"

      cb(null, html)
    }

    let user = { author: msg.value.author, name: msg.value.author }
    if (SSB.profiles)
      user = SSB.profiles[msg.value.author]
    if (msg.value.author == SSB.net.id)
      user.name = "You"
    if (user && user.image) {
      SSB.net.blobs.localGet(user.image, (err, url) => {
        if (!err)
          html += `<img class='avatar' src='${url}' />`

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
        console.log(msgs.length)
      })
    )
  }
  */

  function renderMessages(onlyThreads, messages) {
    document.getElementById("newPublicMessages").innerHTML = ""

    var html = "<h2>Last 50 messages</h2>"
    html += "Threads only: <input id='onlyThreads' type='checkbox'"
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
              <span id="publicMessageInput" style="display:none">
              <textarea class="messageText" id="message"></textarea><br>
              </span>
              <button id="postMessage">Post new thread</button>
              <input type="file" id="publicMessageFileInput" style="display:none">`

        document.getElementById("bottom").innerHTML = ""

        document.getElementById("publicMessageFileInput").addEventListener("change", function(ev) {
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
          if (document.getElementById("publicMessageInput").style.display == "none") {
            document.getElementById("publicMessageInput").style = ""
            document.getElementById("publicMessageFileInput").style = ""
            return
          }

          var text = document.getElementById("message").value
          if (text != '')
          {
            SSB.publish({ type: 'post', text }, (err) => {
              if (err) console.log(err)

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

    document.getElementById("newPrivateMessages").innerHTML = ""

    pull(
      pull.values(messages),
      pull.filter((msg) => !msg.value.content.root), // top posts
      paramap(renderMessage, 1),
      pull.collect((err, rendered) => {
        document.getElementById("top").innerHTML = `
              <span id="privateMessageInput" style="display:none">
              <input type="text" id="recipients" placeholder="recipient ids (, seperator)" />
              <input type="text" id="subject" placeholder="subject" />
              <textarea class="messageText" id="message"></textarea><br>
              </span>
              <button id="postPrivateMessage">Post private message</button>`
        document.getElementById("postPrivateMessage").addEventListener("click", function() {
          if (document.getElementById("privateMessageInput").style.display == "none") {
            document.getElementById("privateMessageInput").style = ""
            return
          }

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

            SSB.publish(content, (err) => {
              if (err) console.log(err)

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
    document.getElementById("top").innerHTML = `<div style='margin-bottom: 10px'>Your id: ${SSB.net.id} </div>
              <button id="acceptConnections">Accept incoming connections</button>   or  
              <input type="text" id="tunnelConnect" placeholder="@remoteId to connect to" />
              <input type="text" id="chatMessage" placeholder="type message, enter to send" />`

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

    document.getElementById("messages").innerHTML = `<h2>Off-chain messages</h2> 
      <div id="chatDescription">Off-chain messages are messages sent
      encrypted between you and the other end through the magic of
      tunnels. These messages are ephemeral and will be gone forever
      when you change view!</div>`

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
      <textarea class="messageText" id="message"></textarea><br>
      <button id="postReply">Post reply</button>`

    document.getElementById("postReply").addEventListener("click", function() {
      var text = document.getElementById("message").value
      if (text != '')
      {
        var content = { type: 'post', text, root: rootId, branch: lastMsgId }
        if (recps) {
          content.recps = recps
          content = SSB.box(content, recps.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        SSB.publish(content, (err) => {
          if (err) console.log(err)

          renderThread(rootId)
        })
      }
    })
  }

  function renderThread(rootId) {
    function render(rootMsg)
    {
      var html = `<h2>Thread ${rootId}</h2>`
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
          pull.filter((msg) => msg.value.content.type == 'post'),
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
              timestamp: { $gt: 0 },
              author: author,
              content: {
                type: 'post'
              }
            }
          }
        }]
      }),
      pull.collect((err, msgs) => {
        var name = author
        if (SSB.profiles && SSB.profiles[author])
          name = SSB.profiles[author].name

        document.getElementById("top").innerHTML = ''
        if (author != SSB.net.id) {
          SSB.db.friends.isFollowing({source: SSB.net.id, dest: author }, (err, status) => {
            if (status) {
              document.getElementById("top").innerHTML = 'You are following - <button id="unfollow">Unfollow</button>'
              document.getElementById("unfollow").addEventListener("click", function(ev) {
                ev.preventDefault()

                var contact = SSBContactMsg(SSB)
                contact.unfollow(author, () => {
                  alert("unfollowed!") // FIXME: proper UI
                })
              })
            } else {
              document.getElementById("top").innerHTML = '<button id="follow">Follow</button>'
              document.getElementById("follow").addEventListener("click", function(ev) {
                ev.preventDefault()

                var contact = SSBContactMsg(SSB)
                contact.follow(author, () => {
                  SSB.syncFeedAfterFollow(author)
                  alert("followed!") // FIXME: proper UI
                })
              })
            }
          })
        }

        var html = "<h2>Last 50 messages for " + name + " <div style='font-size: 15px'>(" + author + ")</div></h2>"

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

  function newMessagesNotify() {
    pull(
      SSB.db.query.read({
        live: true,
        old: false,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              content: { type: 'post' }
            }
          }
        }]
      }),
      pull.filter((msg) => !msg.value.meta),
      pull.drain(() => {
        document.getElementById("newPublicMessages").innerHTML = "&#127881;"
      })
    )
  }

  function newPrivateMessagesNotify() {
    pull(
      SSB.db.query.read({
        live: true,
        old: false,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              content: { type: 'post', recps: { $truthy: true } }
            }
          }
        }]
      }),
      pull.drain(() => {
        document.getElementById("newPrivateMessages").innerHTML = "&#128274;"
      })
    )
  }

  function updateDBStatus() {
    setTimeout(() => {
      if (typeof SSB === 'undefined') {
        updateDBStatus()
        return
      }

      if (!SSB.remoteAddress)
        SSB.remoteAddress = document.getElementById("remoteAddress").value

      if (!SSB.onboard)
        loadOnboardBlob()

      if (!SSB.profiles) {
        SSB.loadProfiles()
        if (screen == 'public')
          renderPublic()

        newMessagesNotify()
        newPrivateMessagesNotify()
      }

      const status = SSB.db.getStatus()

      if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
        updateDBStatus()

        return
      }

      lastStatus = status

      var statusHTML = "<b>DB status</b>"
      if (status.since == 0 || status.since == -1) // sleeping
        statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&FT0Klmzl45VThvWQIuIhmGwPoQISP+tZTduu/5frHk4=.sha256')}'/>`
      else if (!status.sync) // hammer time
        statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&IGPNvaqpAuE9Hiquz7VNFd3YooSrEJNofoxUjRMSwww=.sha256')}'/>`
      else { // dancing
        statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&utxo7ToSNDhHpXpgrEhJo46gwht7PBG3nIgzlUTMmgU=.sha256')}'/>`
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
      changeScreen(ev, 'thread')
      renderThread(ev.target.getAttribute('href'))
    }
    else if (ev.target.tagName === 'A' && ev.target.getAttribute('href').startsWith("@"))
    {
      changeScreen(ev, 'profile')
      renderProfile(ev.target.getAttribute('href'))
    }
  })

  document.getElementById("threadId").addEventListener('keydown', function(ev) {
    if (ev.keyCode == 13) // enter
    {
      var text = document.getElementById("threadId").value
      if (text != '' && text.startsWith('%')) {
        changeScreen(ev, 'thread')
        renderThread(text)
      } else if (text != '' && text.startsWith('@')) {
        changeScreen(ev, 'profile')
        renderProfile(text)
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

  // settings

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

  var settings = {
    syncOnlyFollows: false,
    remoteAddress: 'ws:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519'
  }

  if (localStorage['settings']) {
    settings = JSON.parse(localStorage['settings'])
    if (settings.syncOnlyFollows)
      document.getElementById("syncOnlyFollows").checked = true
    document.getElementById("remoteAddress").value = settings.remoteAddress
  }

  document.getElementById("syncOnlyFollows").addEventListener("click", function(ev) {
    settings.syncOnlyFollows = ev.target.checked
    localStorage['settings'] = JSON.stringify(settings)
  })

  document.getElementById("remoteAddress").addEventListener('keydown', function(e) {
    var text = e.target.value
    if (e.keyCode == 13 && text != '') { // enter
      settings.remoteAddress = text
      localStorage['settings'] = JSON.stringify(settings)
    }
  })
 
})()
