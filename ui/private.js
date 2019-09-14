const pull = require('pull-stream')
const paramap = require('pull-paramap')

module.exports = function () {
  //const renderMessage = require('./renderMessage')().renderMessage
  
  return {
    template: `<span v-if="postMessageVisible">
        <input type="text" id="recipients" v-model="recipients" placeholder="recipient ids (, seperator)" />
        <input type="text" id="subject" v-model="subject" placeholder="subject" />
        <textarea class="messageText" v-model="postText"></textarea><br>
        </span>
        <button v-on:click="onPost">Post private message</button>
        <h2>Private messages</h2>
        <div id="messages"></div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        subject: "",
        recipients: ""
      }
    },

    methods: {
      renderPrivateMessages: function(messages) {
        
        // hacky, own module instead
        document.getElementById("newPrivateMessages").innerHTML = ""

        pull(
          pull.values(messages),
          pull.filter((msg) => !msg.value.content.root), // top posts
          paramap(renderMessage, 1),
          pull.collect((err, rendered) => {
            document.getElementById("messages").innerHTML = rendered.join('')
          })
        )
      }
    },

    renderPrivate: function() {
      // hacky
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
    },

    onPost: function() {
      if (!this.postMessageVisible) {
        this.postMessageVisible = true
        return
      }

      var recps = this.recipients.value.split(',').map(x => x.trim())

      if (!recps.every(x => x.startsWith("@")))
      {
        alert("recipients must start with @")
        return
      }

      if (!recps.includes(SSB.net.id))
        recps.push(SSB.net.id)
              
      if (this.postText != '' && this.subject != '')
      {
        var content = { type: 'post', text: this.postText, subject: this.subject }
        if (recps) {
          content.recps = recps
          content = SSB.box(content, recps.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
        }

        SSB.publish(content, (err) => {
          if (err) console.log(err)
                  
          renderPrivate()
        })
      }
    }
  }
}
