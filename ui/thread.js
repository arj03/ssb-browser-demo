module.exports = function () {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const ssbMentions = require('ssb-mentions')
  const sort = require('ssb-sort')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  let initialState = function(self, rootId) {
    return {
      componentStillLoaded: false,
      fixedRootId: rootId,
      title: rootId,
      latestMsgIdInThread: rootId,
      recipients: undefined, // for private messages only
      postText: '',
      messages: [],
      participantsBlocking: [],
      rootMsg: { key: '', value: { content: {} } },

      showPreview: false
    }
  }

  return {
    template: `
       <div id="thread">
         <h2>{{ $t('thread.title', { title: title }) }}</h2>
         <ssb-msg v-bind:key="rootMsg.key" v-bind:msg="rootMsg" v-bind:thread="fixedRootId"></ssb-msg>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <div id="blockingReplies" v-if="participantsBlocking.length > 0">{{ $t('thread.blockingReplies') }}<br />
           <ssb-profile-link v-for="participant in participantsBlocking" v-bind:feedId="participant"></ssb-profile-link>
           <div class="clearingDiv"></div>
         </div>
         <markdown-editor :initialValue="postText" ref="markdownEditor" /><br>
         <button class="clickButton" v-on:click="postReply">{{ $t('thread.postReply') }}</button>
         <input type="file" class="fileInput" v-on:change="onFileSelect">
         <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
       <div>`,

    props: ['rootId'],
    
    data: function() {
      return initialState(this, '%' + this.rootId)
    },

    methods: {
      onFileSelect: function(ev) {
        var self = this
        helpers.handleFileSelect(ev, this.recipients != undefined, (err, text) => {
          self.postText += text
        })
      },

      closePreview: function() {
        this.showPreview = false
      },

      postReply: function() {
        this.postText = this.$refs.markdownEditor.getMarkdown()

        // Make sure the full post (including headers) is not larger than the 8KiB limit.
        var postData = this.buildPostData()
        if (JSON.stringify(postData).length > 8192) {
          alert(this.$root.$t('common.postTooLarge'))
          return
        }

        if (this.postText == '') {
          alert(this.$root.$t('thread.blankFieldError'))
          return
        }

        this.showPreview = true
      },

      buildPostData: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.box) {
          alert("Can't post right now.  Couldn't lock the database.  Please make sure you have only one running instance of ssb-browser.")
          return
        }

        var mentions = ssbMentions(this.postText)
        var content = { type: 'post', text: this.postText, root: this.fixedRootId, branch: this.latestMsgIdInThread, mentions }

        if (this.recipients) {
          content.recps = this.recipients
          content = SSB.box(content, this.recipients.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        return content
      },

      confirmPost: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.db) {
          alert("Can't post right now.  Couldn't lock the database.  Please make sure you have only one running instance of ssb-browser.")
          return
        }

        var self = this

        content = this.buildPostData()

        SSB.db.publish(content, (err) => {
          if (err) console.error(err)

          self.postText = ""
          self.showPreview = false
          if (self.$refs.markdownEditor)
            self.$refs.markdownEditor.setMarkdown(self.descriptionText)

          // Display it right away for now, and then refresh to see if we have any other new messages.
          self.messages.push({ key: null, value: { content: content } })
          self.renderThread()
        })
      },

      render: function(SSB, rootMsg) {
        const { where, and, hasRoot, toCallback } = SSB.dbOperators

        var self = this
        this.rootMsg = { key: this.fixedRootId, value: rootMsg }
        this.recipients = rootMsg.content.recps

        this.title = helpers.getMessageTitle(this.fixedRootId, rootMsg)
        document.title = this.$root.appTitle + " - " + this.$root.$t('thread.title', { title: this.title })

        SSB.db.query(
          where(hasRoot(this.fixedRootId)),
          toCallback((err, msgs) => {
            if (err) return console.error(err)

            var allMessages = []
            if (msgs.length > 0) {
              this.latestMsgIdInThread = msgs[msgs.length-1].key

              // determine if messages exists outside our follow graph
              var knownIds = [this.fixedRootId, ...msgs.map(x => x.key)]

              function insertMissingMessages(msg) {
                if (typeof msg.value.content.branch === 'string')
                {
                  if (!knownIds.includes(msg.value.content.branch)) {
                    allMessages.push({
                      key: msg.value.content.branch,
                      value: {
                        content: {
                          text: self.$root.$t('common.messageOutsideGraph')
                        }
                      }
                    })
                  }
                }
                else if (Array.isArray(msg.value.content.branch))
                {
                  msg.value.content.branch.forEach((branch) => {
                    if (!knownIds.includes(branch)) {
                      allMessages.push({
                        key: branch,
                        value: {
                          content: {
                            text: self.$root.$t('common.messageOutsideGraph')
                          }
                        }
                      })
                    }
                  })
                }
              }

              msgs.forEach((msg) => {
                if (msg.value.content.type != 'post') return

                insertMissingMessages(msg)
                allMessages.push(msg)
              })
            }

            this.messages = sort(allMessages)

            this.updateBlockingStatus()
          })
        )
      },

      updateBlockingStatus: function() {
        var self = this
        var allAuthors = (this.messages.concat(this.rootMsg)).map((x) => { return x.value.author })
          .filter((x, index, self) => { return self.indexOf(x) == index })
        this.participantsBlocking = []
        for (a in allAuthors) {
          (function(author) {
            SSB.net.friends.isBlocking({ source: author, dest: SSB.net.id}, (err, blocking) => {
              if (blocking)
                self.participantsBlocking.push(author)
            })
          })(allAuthors[a])
        }
      },

      renderThread: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.renderThreadCB)
      },

      renderThreadCB: function(err, SSB) {
        var self = this
        SSB.db.get(self.fixedRootId, (err, rootMsg) => {
          if (err || rootMsg === undefined) { // FIXME: make this configurable
            SSB.getThread(self.fixedRootId, (err) => {
              if (err) console.error(err)

              SSB.db.get(self.fixedRootId, (err, rootMsg) => {
                if (err || rootMsg === undefined) {
                  console.error(err)
                  self.render(SSB, { content: { text: self.$root.$t('common.unknownMessage') }})
                } else
                  self.render(SSB, rootMsg)
              })
            })
          } else
            self.render(SSB, rootMsg)
        })
      }
    },

    beforeRouteUpdate(to, from, next) {
      Object.assign(this.$data, initialState(this, '%' + to.params.rootId))
      this.renderThread()
      next()
    },

    created: function () {
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('thread.title', { title: this.title })

      this.renderThread()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    }
  }
}
