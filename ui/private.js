const pull = require('pull-stream')

module.exports = function () {
  return {
    template: `<div id="private">
        <span v-if="postMessageVisible">
        <v-select placeholder="recipients" multiple v-model="recipients" :options="people" label="name">
          <template slot="option" slot-scope="option">
            <img v-if='option.image' class="tinyAvatar" :src='option.image' />
            <span>{{ option.name }}</span>
          </template>
        </v-select>
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
        people: [],
        recipients: [],
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

        let recps = this.recipients.map(x => x.id)

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
            content = SSB.box(content, recps.map(x => x.substr(1)))
          }

          SSB.publish(content, (err) => {
            if (err) console.log(err)

            this.postMessageVisible = false
            this.postText = ""
            this.subject = ""
            this.recipients = []

            this.renderPrivate()
          })
        } else {
          alert("Please provide both subject and text in private messages")
        }
      }
    },

    created: function () {
      this.renderPrivate()

      // FIXME: helper function
      var self = this

      const last = SSB.db.last.get()

      for (let id in SSB.profiles) {
        const profile = SSB.profiles[id]

        if (profile.image && last[id])
          SSB.net.blobs.localGet(profile.image, (err, url) => {
            self.people.push({
              id: id,
              name: profile.name || id,
              image: err ? '' : url
            })
          })
        else if (last[id])
          self.people.push({
            id: id,
            name: profile.name || id,
            image: ''
          })
      }
    }
  }
}
