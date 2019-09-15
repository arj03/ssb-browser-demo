const pull = require('pull-stream')

module.exports = function () {
  return {
    template: `
       <div id="thread">
         <h2>Thread {{ rootId }}</h2>
         <ssb-msg v-bind:key="rootMsg.key" v-bind:msg="rootMsg"></ssb-msg>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <textarea class="messageText" v-model="postText"></textarea><br>
         <button v-on:click="postReply">Post reply</button>
       <div>`,

    props: ['rootId'],
    
    data: function() {
      return {
        latestMsgIdInThread: this.rootId,
        recipients: undefined, // for private messages only
        postText: '',
        messages: [],
        rootMsg: undefined
      }
    },

    methods: {
      postReply: function() {
        if (this.postText != '')
        {
          var content = { type: 'post', text: this.postText, root: this.rootId, branch: this.latestMsgIdInThread }
          if (this.recipients) {
            content.recps = this.recipients
            content = SSB.box(content, this.recipients.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
          }

          SSB.publish(content, (err) => {
            if (err) console.log(err)

            renderThread()
          })
        }
      },

      render: function(rootMsg) {
        this.rootMsg = { key: '', value: rootMsg }
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
            this.messages = msgs
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
