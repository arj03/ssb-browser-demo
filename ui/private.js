module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const ssbMentions = require('ssb-mentions')

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
        <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <h2>Private messages</h2>
        <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
        <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        subject: "",
        people: [],
        recipients: [],
        messages: [],

        showPreview: false
      }
    },

    methods: {
      renderPrivate: function() {
        componentsState.newPrivateMessages = false

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
                seek: SSB.db.jitdb.seekPrivate,
                value: Buffer.from("true"),
                indexType: "private"
              }
            }]
          }
          const queryRootOnly = {
            type: 'AND',
            data: [query, {
              type: 'EQUAL',
              data: {
                seek: SSB.db.jitdb.seekRoot,
                value: undefined,
                indexType: "root"
              }
            }]
          }

          console.time("private messages")
          SSB.db.jitdb.query(queryRootOnly, 50, (err, results) => {
            this.messages = results
            console.timeEnd("private messages")
          })
        })
      },

      onFileSelect: function(ev) {
        var self = this
        helpers.handleFileSelect(ev, true, (err, text) => {
          self.postText += text
        })
      },

      closePreview: function() {
        this.showPreview = false
      },

      onPost: function() {
        if (!this.postMessageVisible) {
          this.postMessageVisible = true
          return
        }

        if (this.postText == '' || this.subject == '') {
          alert("Please provide both subject and text in private messages")
          return
        }

        this.showPreview = true
      },

      confirmPost: function() {
        let recps = this.recipients.map(x => x.id)

        if (!recps.every(x => x.startsWith("@"))) {
          alert("recipients must start with @")
          return
        }

        if (!recps.includes(SSB.net.id))
          recps.push(SSB.net.id)

        var mentions = ssbMentions(this.postText)

        var content = { type: 'post', text: this.postText, subject: this.subject, mentions }
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
          this.showPreview = false

          this.renderPrivate()
        })
      }
    },

    created: function () {
      this.renderPrivate()

      helpers.getPeople((err, people) => {
        this.people = people
      })
    }
  }
}
