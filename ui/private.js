module.exports = function (componentsState) {
  const helpers = require('./helpers')
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const { and, isPrivate, isRoot, type, toCallback } = SSB.dbOperators

  return {
    template: `<div id="private">
        <span v-if="postMessageVisible">
        <v-select placeholder="recipients" multiple v-model="recipients" :options="people" label="name" @search="suggest">
          <template #option="{ name, image }">
            <img v-if='image' class="tinyAvatar" :src='image' />
            <span>{{ name }}</span>
          </template>
        </v-select>
        <input type="text" id="subject" v-model="subject" placeholder="subject" />
        <textarea class="messageText" v-model="postText"></textarea><br>
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
      suggest: function(searchString, loading) {
        var self = this
        loading(true)
        console.log("Searching for:")
        console.log(searchString)
        // I have no idea why, but we have to run this twice to get the results we're looking for.
        SSB.net.suggest.profile({ text: searchString }, (err, matches) => {
          SSB.net.suggest.profile({ text: searchString }, (err, matches) => {
            if (matches) {
              console.log("Found:")
              console.log(matches)
              for (m in matches) {
                var alreadyInPeople = false
                for (p in self.people) {
                  if (matches[m].id == self.people[p].id) {
                    alreadyInPeople = true
                    break
                  }
                }
                if (!alreadyInPeople)
                  // Strip out the image, because I don't know how to pull that.
                  self.people.push({ id: matches[m].id, name: matches[m].name })
              }
            }
  
            // Sort the people array.
            var collator = new Intl.Collator()
            self.people = self.people.sort((a, b) => { return collator.compare(a.name, b.name) })
  
            loading(false)
          })
        })
      },

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
    }
  }
}
