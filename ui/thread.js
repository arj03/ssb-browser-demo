const pull = require('pull-stream')
const paramap = require('pull-paramap')

module.exports = function () {
  return {
    template: `
       <h2>Thread {{ rootId }}</h2>
       <div id="messages"></div>
       <textarea class="messageText" v-model="postText"></textarea><br>
       <button v-on:click="postReply">Post reply</button>`,

    props: ['rootId'],
    
    data: function() {
      return {
        latestMsgIdInThread: this.rootId,
        recipients: undefined, // for private messages only
        postText: ''
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
        this.recipients = rootMsg.content.recps

        renderMessage({ value: rootMsg }, (err, rootMsgHTML) => {
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
            paramap(renderMessage, 1),
            pull.collect((err, rendered) => {
              document.getElementById("messages").innerHTML = rootMsgHTML + rendered.join('')
              window.scrollTo(0, 0)
            })
          )
        })
      },

      renderThread: function() {
        SSB.db.get(this.rootId, (err, rootMsg) => {
          if (err) { // FIXME: make this configurable
            SSB.getThread(this.rootId, (err) => {
              if (err) console.error(err)

              SSB.db.get(this.rootId, (err, rootMsg) => {
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
    }
  }
}
