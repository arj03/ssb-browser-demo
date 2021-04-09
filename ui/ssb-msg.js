const human = require('human-time')
const md = require('./markdown')
const helpers = require('./helpers')
const pull = require('pull-stream')
const ssbSingleton = require('ssb-browser-core/ssb-singleton')
const copy = require("clipboard-copy")

Vue.component('ssb-msg', {
  template: `
      <div class='message' @contextmenu="onContextMenu">
        <div class='header'>
          <span class="profile">
            <ssb-profile-link v-bind:key="msg.value.author" v-bind:feedId="msg.value.author"></ssb-profile-link>
          </span>
          <span class='text'>
            <div class='date' :title='date'>{{ humandate }}</div>
            <ssb-profile-name-link v-bind:key="msg.value.author" v-bind:feedId="msg.value.author"></ssb-profile-name-link> {{ $t('common.posted') }}
            <span v-if="msg.value.content.root && msg.value.content.root != msg.key">
              {{ $t('common.inReplyTo') }} <router-link :to="{name: 'thread', params: { rootId: rootId }}">{{ parentThreadTitle }}</router-link>
            </span>
            <span v-else>
              {{ $t('common.a') }} <router-link :to="{name: 'thread', params: { rootId: rootId }}">{{ $t('pages.thread') }}</router-link>
            </span>
          </span>
          <span class='channel' v-if="msg.value.content.channel">
            <router-link :to="{name: 'channel', params: { channel: msg.value.content.channel }}">#{{ msg.value.content.channel }}</router-link>
          </span>
        </div>

        <h2 v-if="(msg.value.content.subject || msg.value.content.title) && msg.key">
          <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ msg.value.content.subject || msg.value.content.title }}</router-link>
        </h2>

        <span v-html="body"></span>

        <div class="contactMessage" v-if="msg.value.content.type == 'contact' && body == ''">
          <p>
            <span v-if="msg.value.content.following">{{ $t('common.startedFollowing') }}</span>
            <span v-if="!msg.value.content.following">{{ $t('common.stoppedFollowing') }}</span>
          </p>
          <p class="contactLink">
            <span class="profile">
              <ssb-profile-link v-bind:key="msg.value.content.contact" v-bind:feedId="msg.value.content.contact"></ssb-profile-link>
            </span>
            <span class="text">
              <router-link :to="{name: 'profile', params: { feedId: msg.value.content.contact }}">{{ contactName }}</router-link>
            </span>
          </p>
        </div>

        <span v-if="forks.length > 0"><b>{{ $t('common.Forks') }}:</b>
          <li v-for="msg in forks">
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ smallText(msg) }}</router-link>
          </li>
        </span>
        <span v-if="mentions.length > 0"><b>{{ $t('common.Mentions') }}:</b>
          <li v-for="msg in mentions">
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ smallText(msg) }}</router-link>
          </li>
        </span>
        <span v-if="isOOO"><a href="javascript:void(0);" v-on:click="getOOO">{{ $t('common.getMsg') }}</a></span>
        <div class='reactions'>
          <span class='reactions-existing'>
            <span v-for="reaction in reactions">
              <router-link :to="{name: 'profile', params: { feedId: reaction.authorId }}" v-bind:title="reaction.author">{{ reaction.expression }}</router-link>
            </span>
          </span>
          <span class='reactions-mine' v-if="myReactions.length > 0">
            <span v-for="reaction in myReactions">
              <a title='Remove reaction' href="javascript:void(0);" v-on:click="unlike()">{{ reaction.expression }}</a> 
            </span>
          </span>
          <span class='reactions-new' v-if="myReactions.length == 0 && msg.key">
            <span class='reactions-label'>{{ $t('common.Add') }}: </span>
            <span v-for="emoji in emojiOptionsFavorite">
              <a href="javascript:void(0);" v-on:click="react(emoji)">{{ emoji }}</a> 
            </span>
            <span><a href="javascript:void(0);" @click.prevent.stop="popupEmojiMenu($event)">…</a></span>
          </span>
        </div>
        <vue-simple-context-menu :elementId="'emojiMenu'+Math.floor(Math.random() * 9999999999)" :options="emojiOptionsMore" :ref="'emojiMenu'" @option-clicked="reactMenuOption" />
      </div>`,

  props: ['msg', 'thread'],

  data: function() {
    return {
      componentStillLoaded: false,
      name: this.msg.value.author,
      humandate: human(new Date(this.msg.value.timestamp)),
      forks: [],
      mentions: [],
      reactions: [],
      myReactions: [],
      body: '',
      contactName: '',
      parentThreadTitle: this.$root.$t('ssb-msg.threadTitlePlaceholder'),
      emojiOptions: ['👍', '🖖', '❤', '😄', '😃', '😁', '😆', '😅', '😂', '😉', '😋', '😝', '😐', '😒', '😎', '😧', '😖', '😣', '😞', '🚀', '🍕'],
      emojiOptionsFavorite: [],
      emojiOptionsMore: []
    }
  },

  computed: {
    rootId: function() {
      if (this.msg.value.content.root)
        return this.msg.value.content.root.substring(1)
      else
        return (this.msg.key ? this.msg.key.substring(1) : "")
    },
    date: function() {
      return new Date(this.msg.value.timestamp).toLocaleString("da-DK")
    },
    isOOO: function() {
      return (this.msg.value.content.text == this.$root.$t('common.messageOutsideGraph') || this.msg.value.content.text == this.$root.$t('common.unknownMessage')) && !this.msg.value.author
    }
  },

  methods: {
    updateDate: function() {
      var cur = new Date(this.msg.value.timestamp)
      this.humandate = human(cur)
      const timeDiff = Date.now() - cur.getTime()
      const minute = 60 * 1000
      const hour = 60 * minute
      const interval = (timeDiff < hour ? minute : (timeDiff < 12 * hour ? hour : 6 * hour))
      if (this.componentStillLoaded) {
        setTimeout(this.updateDate, interval)
      }
    },

    onContextMenu: function(e) {
      var self = this
      var options = [
        {
          name: "View whole thread",
          cb: () => {
            self.$root._router.push({name: 'thread', params: { rootId: self.rootId }})
          }
        },
        {
          name: "Open thread in new tab",
          cb: () => {
            ssbSingleton.openWindow(self.$root._router.resolve({name: 'thread', params: { rootId: self.rootId }}).href)
          }
        },
        {
          type: "divider"
        },
        {
          name: "Copy message ID",
          cb: () => {
            copy(self.msg.key)
          }
        },
        {
          name: "Copy thread root ID",
          cb: () => {
            copy("%" + self.rootId)
          }
        },
        {
          type: "divider"
        },
        {
          name: "View source",
          cb: () => {
            var json = JSON.stringify(self.msg, null, 2)
            json = json.replace(/&/g, "&amp;")
            json = json.replace(/</g, "&lt;")
            json = json.replace(/>/g, "&gt;")
            json = json.replace(/"/g, "&quot;")
            json = json.replace(/'/g, "&#039;")
            var sourceHtml = "<textarea class='source'>" + json + "</textarea>"
            self.$root.openSource(sourceHtml)
          }
        },
      ]
      const contextMenu = this.$root.$refs.commonContextMenu
      contextMenu.showMenu(e, options, self)
      e.preventDefault()
      e.stopPropagation()
      return false
    },
    smallText: function(msg) {
      if (msg.value.content && msg.value.content.text)
        return msg.value.content.text.substring(0,50)
      else
        return ''
    },
    getOOO: function() {
      var self = this
      ssbSingleton.getSSBEventually(5000, () => { return self.componentStillLoaded },
        (SSB) => { return SSB && SSB.net && SSB.getOOO && SSB.isConnected() }, self.getOOOCallback)
    },
    getOOOCallback: function(err, SSB) {
      if (err) {
        alert("Failed to get msg: " + err)
        return
      }

      SSB.getOOO(this.msg.key, (err, msgValue) => {
        if (err) return alert("Failed to get msg " + err)

        this.msg = { key: this.msg.key, value: msgValue }
        this.renderMessage(null, SSB)

        SSB.net.friends.isBlocking({ source: SSB.net.id, dest: msgValue.author }, (err, result) => {
          if (result) this.msg.value.content.text = "Blocked user"
        })
      })
    },
    react: function(emoji) {
      [ err, SSB ] = ssbSingleton.getSSB()
      if (!SSB || !SSB.db) {
        alert("Can't post a reaction right now.  Couldn't lock the database.  Please make sure you're only running one instance of ssb-browser.")
      }

      var voteValue = 1
      if (emoji == 'Unlike') {
        this.myReactions = []
        voteValue = 0
      } else
        this.myReactions.push({ expression: emoji })

      var reactTo = this.msg.key
      var message = {
        type: 'vote',
        vote: {
          link: reactTo,
          value: voteValue,
          expression: emoji
        }
      }

      SSB.db.publish(message, (err) => {
        if (err) console.log(err)
      })
    },
    reactMenuOption: function(emojiInfo) {
      this.react(emojiInfo.option.name)
    },
    popupEmojiMenu: function(event) {
      this.$refs.emojiMenu.showMenu(event, {})

      // Fix the positioning.
      var menuEl = document.getElementById(this.$refs.emojiMenu.elementId)
      menuEl.style.left = "auto"
      menuEl.style.top = "auto"
      menuEl.style.bottom = (this.$el.offsetHeight - this.$el.getElementsByClassName("reactions")[0].offsetTop - 2) + "px"
      menuEl.style.right = "0px"
    },
    unlike: function() {
      if (confirm("Are you sure you want to remove your reaction from this post?"))
        this.react('Unlike')
    },
    renderMessage: function (err, SSB) {
      const { where, and, author, about, type, votesFor, hasRoot, descending, mentions, toCallback } = SSB.dbOperators

      this.emojiOptionsFavorite = this.emojiOptions.slice(0, 3)
      this.emojiOptionsMore = this.emojiOptions.slice(3, this.emojiOptions.length).map((x) => { return { name: x } })

      var self = this

      if (this.msg.value.author == SSB.net.id)
        self.name = "You"
      else
        self.name = SSB.getProfileName(this.msg.value.author)

      switch(this.msg.value.content.type) {
        case "about": {
          var newInfo = "<p>" + this.$root.$t((this.msg.value.author != this.msg.value.content.about ? 'common.profileUpdateOther' : 'common.profileUpdateSelf'), { user: (self.name || this.$root.$t('common.genericUsername')) }) + "</p>"
          self.body = newInfo

          // Try to find the next-to-latest profile update so we can show what changed.
          SSB.db.query(
            where(
              and(
                author(this.msg.value.content.about),
                about(this.msg.value.content.about)
              )
            ),
            descending(),
            toCallback((err, msgs) => {
              var foundOurMsg = false
              for (m in msgs) {
                if (msgs[m].key == self.msg.key) {
                  // We found our message.  Now look back in history to find the most recent updates to each component.
                  var oldName = null
                  var oldImage = null
                  var oldDescription = null
                  for (n = (m * 1) + 1; n < msgs.length; ++n) {
                    if (msgs[n].value.content.about == self.msg.value.author && msgs[n].key != self.msg.key) {
                      // Found a profile update from our message's author and about our message's author, and it's not a duplicate message that db2 sometimes returns.
                      if (!oldName && msgs[n].value.content.name)
                        oldName = msgs[n].value.content.name
                      if (!oldImage && msgs[n].value.content.image)
                        oldImage = msgs[n].value.content.image
                      if (!oldDescription && msgs[n].value.content.description)
                        oldDescription = msgs[n].value.content.description
                    }
                    if (oldName && oldImage && oldDescription)
                      break
                  }

                  // We should have a copy of the next-most-recent info now, which means we have enough data to show what's changed.
                  var changes = ""
                  if (self.msg.value.content.image && self.msg.value.content.image != oldImage) {
                    changes += "<li>Changed image</li>"
                    const newProfile = SSB.getProfile(self.msg.value.author)
                    if (oldImage) {
                      SSB.net.blobs.localProfileGet(oldImage, (err, oldImageURL) => {
                        if (err) return console.error("failed to get img", err)
                        if (newProfile.image) {
                          // Fetch their current image.
                          SSB.net.blobs.localProfileGet(newProfile.image, (err, newImageURL) => {
                            if (err) return console.error("failed to get img", err)
                            var newImageHTML = "<img class='avatar' src='" + oldImageURL + "' /> ⇉ <img class='avatar' src='" + newImageURL + "'/>"
                            newInfo = newInfo.replace("Changed image", newImageHTML)
                            self.body = newInfo
                            changes = changes.replace("Changed image", newImageHTML) // In case this finishes before the parent.
                          })
                        } else {
                          // Evidently they erased their image.
                          var newImageHTML = "<img class='avatar' src='" + oldImageURL + "' /> ⇉ <img class='avatar' src='" + helpers.getMissingProfileImage() + "'/>"
                          newInfo = newInfo.replace("Changed image", newImageHTML)
                          self.body = newInfo
                          changes = changes.replace("Changed image", newImageHTML) // In case this finishes before the parent.
                        }
                      })
                    } else if (newProfile.image) {
                      // They didn't have an image before, and they do now.
                      SSB.net.blobs.localProfileGet(newProfile.image, (err, newImageURL) => {
                        if (err) return console.error("failed to get img", err)
                        var newImageHTML = "<img class='avatar' src='" + helpers.getMissingProfileImage() + "' /> ⇉ <img class='avatar' src='" + newImageURL + "'/>"
                        newInfo = newInfo.replace("Changed image", newImageHTML)
                        self.body = newInfo
                        changes = changes.replace("Changed image", newImageHTML) // In case this finishes before the parent.
                      })
                    }
                  }
                  if (self.msg.value.content.name && self.msg.value.content.name != oldName)
                    changes += "<li>" + (oldName || "(No name)") + " ⇉ " + self.msg.value.content.name + "</li>"
                  if (self.msg.value.content.description && self.msg.value.content.description != oldDescription) {
                    var oldDescriptionSnippet = (oldDescription ? (oldDescription.length > 25 ? oldDescription.substring(0, 22) + "..." : oldDescription) : "(No description)")
                    var newDescriptionSnippet = (self.msg.value.content.description.length > 25 ? self.msg.value.content.description.substring(0, 22) + "..." : self.msg.value.content.description)
                    changes += "<li>&quot;" + oldDescriptionSnippet + "&quot; ⇉ &quot;" + newDescriptionSnippet + "&quot;</li>"
                  }
                  if (changes == "") {
                    newInfo += "<p>(No changes found)</p>"
                  } else {
                    newInfo += "<ul class='profileUpdate'>" + changes + "</ul>"
                  }
                  self.body = newInfo
                  break
                }
              }
            })
          )
        } break;
        case "contact": {
          if (this.msg.value.content.contact) {
            var otherProfileName = SSB.getProfileName(self.msg.value.content.contact)
            self.contactName = otherProfileName || self.$root.$t('common.genericUsername')
            if (!otherProfileName) {
              // Give the profile index a little time to load and then try again.
              setTimeout(() => {
                var otherProfileName = SSB.getProfileName(self.msg.value.content.contact)
                self.contactName = otherProfileName || self.$root.$t('common.genericUsername')
              }, 3000)
            }
          } else {
            self.body = "<p>" + this.$root.$t('common.unknownMessage') + "</p>"
          }
        } break;
        case "blog": {
          function fetchBlogContent() {
            pull(
              SSB.net.blobs.get({ key: self.msg.value.content.blog }),
              pull.take(1),
              pull.collect((err, blobContent) => {
                self.body = md.markdown((new TextDecoder("utf-8")).decode(blobContent[0]))
              })
            )
          }

          SSB.net.blobs.localGet(this.msg.value.content.blog, (err, url) => {
            if (err) {
              if (!SSB.isConnectedWithData()) {
                // Likely don't have it locally and not connected.  So wait until we are connected, then try to fetch it, then parse it.
                SSB.connectedWithData(() => {
                  SSB.net.blobs.localGet(self.msg.value.content.blog, (err, url) => {
                    if (err)
                      self.body = err
                    else
                      fetchBlogContent()
                  })
                })
              } else {
                self.body = err
              }
            } else {
              // It's already local.
              fetchBlogContent()
            }
          })
        } break;
        default: {
          self.body = md.markdown(this.msg.value.content.text)
        }
      }
      
      if (!this.msg.key) return

      SSB.db.query(
        where(votesFor(this.msg.key)),
        toCallback((err, msgs) => {    
          if (err) {
            console.log("Error getting votes: " + err)
            return
          }

          let authorToReaction = {}

          function isUnlike(msg) {
            return msg.value.content.vote.expression == 'Unlike' || msg.value.content.vote.value == 0
          }

          msgs.forEach(msg => {
            if (isUnlike(msg))
              delete authorToReaction[msg.value.author]
            else {
              let expression = msg.value.content.vote.expression
              if (expression === 'Like')
                expression = '👍'
              else if (expression === 'dig')
                expression = '🖖'
              else if (expression === 'heart')
                expression = '❤'

              authorToReaction[msg.value.author] = {
                author: SSB.getProfileName(msg.value.author),
                authorId: msg.value.author,
                expression
              } 
            }
          })

          this.reactions = Object.entries(authorToReaction).filter(([k,v]) => k != SSB.net.id).map(([k,v]) => v)
          this.myReactions = authorToReaction[SSB.net.id] ? [authorToReaction[SSB.net.id]] : []
        })
      )

      if (this.msg.key != this.thread) {
        SSB.db.query(
          where(hasRoot(this.msg.key)),
          toCallback((err, msgs) => {
            if (err) return console.error("error getting root", err)
            this.forks = msgs.filter(m => m.value.content.type == 'post' && m.value.content.fork == this.msg.value.content.root)
          })
        )
      }

      // If it's a reply to a thread, try to pull the thread title.
      if (this.msg.key != this.thread) {
        SSB.db.get(this.thread, (err, rootMsg) => {
          if (rootMsg) {
            var newTitle = helpers.getMessageTitle(self.thread, rootMsg)
            self.parentThreadTitle = (newTitle != self.thread ? newTitle : self.$root.$t('ssb-msg.threadTitlePlaceholder'))
          }
        })
      }

      SSB.db.query(
        where(mentions(this.msg.key)),
        toCallback((err, results) => {
          this.mentions = results
        })
      )
    }
  },

  created: function() {
    this.componentStillLoaded = true
    var self = this
    ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
      (SSB) => { return SSB && SSB.db && SSB.net }, self.renderMessage)
    this.updateDate()
  },

  destroyed: function() {
    this.componentStillLoaded = false
  }
})
