const pull = require('pull-stream')

module.exports = function () {
  return {
    template: `<div id="private">
        <span v-if="postMessageVisible">
        <input type="text" id="recipients" v-model="recipients" placeholder="recipient ids (, seperator)" />
        <input type="text" id="subject" v-model="subject" placeholder="subject" />
        <textarea class="messageText" v-model="postText"></textarea><br>
        </span>
        <button class="clickButton" v-on:click="onPost">Post private message</button>
        <h2>Private messages</h2>
        <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        subject: "",
        recipients: "",
        messages: []
      }
    },

    methods: {
      renderPrivate: function() {
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
          pull.filter((msg) => !msg.value.content.root), // top posts
          pull.collect((err, msgs) => {
            this.messages = msgs
          })
        )
      },

      onPost: function() {
        if (!this.postMessageVisible) {
          this.postMessageVisible = true
          return
        }

        var recps = this.recipients.split(',').map(x => x.trim())

        if (!recps.every(x => x.startsWith("@"))) {
          alert("recipients must start with @")
          return
        }

        if (!recps.includes(SSB.net.id))
          recps.push(SSB.net.id)

        if (this.postText != '' && this.subject != '') {
          var content = { type: 'post', text: this.postText, subject: this.subject }
          if (recps) {
            content.recps = recps
            content = SSB.box(content, recps.map(x => (typeof(x) === 'string' ? x : x.link).substr(1)))
          }

          SSB.publish(content, (err) => {
            if (err) console.log(err)

            this.renderPrivate()
          })
        }
      }
    },

    created: function () {
      this.renderPrivate()
    }
  }
}
