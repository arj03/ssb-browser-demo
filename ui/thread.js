const pull = require('pull-stream')

module.exports = function () {
  return {
    template: `
       <div id="thread">
         <h2>Thread {{ rootId }}</h2>
         <ssb-msg v-bind:key="rootMsg.key" v-bind:msg="rootMsg"></ssb-msg>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <textarea class="messageText" v-model="postText"></textarea><br>
         <button class="clickButton" v-on:click="postReply">Post reply</button>
         <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
       <div>`,

    props: ['rootId'],
    
    data: function() {
      this.rootId = '%' + this.rootId
      return {
        latestMsgIdInThread: this.rootId,
        recipients: undefined, // for private messages only
        postText: '',
        messages: [],
        rootMsg: { key: '', value: { content: {} } },

        showPreview: false
      }
    },

    methods: {
      postReply: function() {
        if (this.showPreview) // second time
          this.showPreview = false
        this.showPreview = true
      },

      confirmPost: function() {
        if (this.postText == '') return

        var content = { type: 'post', text: this.postText, root: this.rootId, branch: this.latestMsgIdInThread }
        if (this.recipients) {
          content.recps = this.recipients
          content = SSB.box(content, this.recipients.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        var self = this

        SSB.publish(content, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.showPreview = false

          self.renderThread()
        })
      },

      render: function(rootMsg) {
        this.rootMsg = { key: this.rootId, value: rootMsg }
        this.recipients = rootMsg.content.recps

        pull(
          SSB.db.query.read({
            query: [{
              $filter: {
                value: {
                  content: { root: this.rootId },
                }
              }
            }]
          }),
          pull.filter((msg) => msg.value.content.type == 'post'),
          pull.through((msg) => this.latestMsgIdInThread = msg.key),
          pull.collect((err, msgs) => {
            var allMessages = []

            // determine if messages exists outside our follow graph
            var knownIds = [this.rootId, ...msgs.map(x => x.key)]
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

            this.messages = allMessages
          })
        )
      },

      renderThread: function() {
        var self = this
        SSB.db.get(this.rootId, (err, rootMsg) => {
          if (err) { // FIXME: make this configurable
            SSB.getThread(self.rootId, (err) => {
              if (err) console.error(err)

              SSB.db.get(self.rootId, (err, rootMsg) => {
                if (err) {
                  console.error(err)
                  self.render({ content: { text: 'Unknown message type' }})
                } else
                  self.render(rootMsg)
              })
            })
          } else
            self.render(rootMsg)
        })
      }
    },

    created: function () {
      this.renderThread()
    },
  }
}
