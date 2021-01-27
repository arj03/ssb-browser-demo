module.exports = function (componentsState) {
  const helpers = require('./helpers')
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const { and, isPrivate, isRoot, type, toCallback } = SSB.dbOperators

  return {
    template: `<div id="private">
        <span v-if="postMessageVisible">
        <v-select placeholder="recipients" multiple v-model="recipients" :options="people" label="name">
          <template #option="{ name, image }">
            <img v-if='image' class="tinyAvatar" :src='image' />
            <span>{{ name }}</span>
          </template>
        </v-select>
        <input type="text" id="subject" v-model="subject" placeholder="subject" />
        <editor usageStatistics="false" :initialValue="postText" initialEditType="wysiwyg" ref="tuiEditor" />
        </span>
        <button class="clickButton" v-on:click="onPost">{{ $t('private.postPrivateMessage') }}</button>
        <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <h2>{{ $t('private.privateMessages') }}</h2>
        <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
        <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    props: ['feedId'],

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
        document.body.classList.add('refreshing')

        var self = this
        if (this.feedId && this.feedId != '') {
          this.postMessageVisible = true
          SSB.getProfileNameAsync(this.feedId, (err, name) => {
            if (self.people.length == 0)
              self.people = [{ id: self.feedId, name: (name || self.feedId) }]
            self.recipients = [{ id: self.feedId, name: (name || self.feedId) }]
    
            // Done connecting and loading the box, so now we can take down the refreshing indicator
            document.body.classList.remove('refreshing')
          })
        }

        componentsState.newPrivateMessages = false

        console.time("private messages")

        SSB.db.query(
          and(isPrivate(), isRoot(), type('post')),
          toCallback((err, results) => {
            this.messages = results
            console.timeEnd("private messages")

            if (!self.feedId || self.feedId == '')
              document.body.classList.remove('refreshing')
          })
        )
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

        this.postText = this.$refs.tuiEditor.invoke('getMarkdown')

        if (this.postText == '' || this.subject == '') {
          alert(this.$root.$t('private.blankFieldError'))
          return
        }

        this.showPreview = true
      },

      confirmPost: function() {
        if (this.recipients.length == 0) {
          alert(this.$root.$t('private.noRecipientError'))
          return
        }

        let recps = this.recipients.map(x => x.id)

        if (!recps.every(x => x.startsWith("@"))) {
          alert(this.$root.$t('private.badRecipientError'))
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

        SSB.db.publish(content, (err) => {
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
      document.title = this.$root.appTitle + " - " + this.$root.$t('private.title')

      this.renderPrivate()

      // Try it right away, and then try again when we're connected in case this is a fresh load and we're only connected to rooms.
      helpers.getPeople((err, people) => {
        this.people = people
      })
      SSB.connectedWithData(() => {
        helpers.getPeople((err, people) => {
          this.people = people
        })
      })
    }
  }
}
