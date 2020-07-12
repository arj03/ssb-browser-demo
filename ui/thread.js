module.exports = function () {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const ssbMentions = require('ssb-mentions')

  let initialState = function(rootId) {
    return {
      fixedRootId: rootId,
      latestMsgIdInThread: rootId,
      recipients: undefined, // for private messages only
      postText: '',
      messages: [],
      rootMsg: { key: '', value: { content: {} } },

      showPreview: false
    }
  }

  return {
    template: `
       <div id="thread">
         <h2>Thread <small>{{ fixedRootId }}</small></h2>
         <ssb-msg v-bind:key="rootMsg.key" v-bind:msg="rootMsg"></ssb-msg>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <textarea class="messageText" v-model="postText"></textarea><br>
         <button class="clickButton" v-on:click="postReply">Post reply</button>
         <input type="file" class="fileInput" v-on:change="onFileSelect">
         <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
       <div>`,

    props: ['rootId'],
    
    data: function() {
      return initialState('%' + this.rootId)
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
        this.showPreview = true
      },

      confirmPost: function() {
        if (this.postText == '') return

        var mentions = ssbMentions(this.postText)
        var content = { type: 'post', text: this.postText, root: this.fixedRootId, branch: this.latestMsgIdInThread, mentions }

        if (this.recipients) {
          content.recps = this.recipients
          content = SSB.box(content, this.recipients.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        var self = this

        SSB.publish(content, (err) => {
          if (err) console.error(err)

          self.postText = ""
          self.showPreview = false

          self.renderThread()
        })
      },

      render: function(rootMsg) {
        this.rootMsg = { key: this.fixedRootId, value: rootMsg }
        this.recipients = rootMsg.content.recps

        console.log("query for", this.fixedRootId)
        
        SSB.db.jitdb.onReady(() => {
          const query = {
            type: 'AND',
            data: [{
              type: 'EQUAL',
              data: {
                seek: SSB.db.jitdb.seekType,
                value: Buffer.from('post'),
                indexType: "type"
              }
            }, {
              type: 'EQUAL',
              data: {
                seek: SSB.db.jitdb.seekRoot,
                value: Buffer.from(this.fixedRootId),
                indexType: "root"
              }
            }]
          }

          SSB.db.jitdb.query(query, 0, (err, msgs) => {
            var allMessages = []
            if (msgs.length > 0) {
              this.latestMsgIdInThread = msgs[msgs.length-1].key

              // determine if messages exists outside our follow graph
              var knownIds = [this.fixedRootId, ...msgs.map(x => x.key)]

              msgs.forEach((msg) => {
                if (typeof msg.value.content.branch === 'string')
                {
                  if (!knownIds.includes(msg.value.content.branch)) {
                    allMessages.push({
                      key: msg.value.content.branch,
                      value: {
                        content: {
                          text: "Message outside follow graph"
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
                            text: "Message outside follow graph"
                          }
                        }
                      })
                    }
                  })
                }

                allMessages.push(msg)
              })
            }

            this.messages = allMessages
          })
        })
      },

      renderThread: function() {
        var self = this
        SSB.db.get(this.fixedRootId, (err, rootMsg) => {
          if (err) { // FIXME: make this configurable
            SSB.getThread(this.fixedRootId, (err) => {
              if (err) console.error(err)

              SSB.db.get(this.fixedRootId, (err, rootMsg) => {
                if (err) {
                  console.error(err)
                  self.render({ content: { text: 'Unknown message type or message outside follow graph' }})
                } else
                  self.render(rootMsg)
              })
            })
          } else
            self.render(rootMsg)
        })
      }
    },

    beforeRouteUpdate(to, from, next) {
      Object.assign(this.$data, initialState('%' + to.params.rootId))
      this.renderThread()
      next()
    },

    created: function () {
      this.renderThread()
    },
  }
}
