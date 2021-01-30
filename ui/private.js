module.exports = function (componentsState) {
  const helpers = require('./helpers')
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const ref = require('ssb-ref')
  const { and, descending, isPrivate, isRoot, type, toCallback } = SSB.dbOperators

  return {
    template: `<div id="private">
        <span v-if="postMessageVisible">
        <v-select placeholder="recipients" multiple v-model="recipients" :options="people" label="name" @search="suggest" @open="recipientsOpen">
          <template #option="{ name, image }">
            <img v-if='image' class="tinyAvatar" :src='image' />
            <span>{{ name }}</span>
          </template>
        </v-select>
        <input type="text" id="subject" v-model="subject" placeholder="subject" />
        <editor :initialValue="postText" ref="tuiEditor" :options="editorOptions" previewStyle="tab" />
        </span>
        <button class="clickButton" v-on:click="onPost">{{ $t('private.postPrivateMessage') }}</button>
        <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <h2>{{ $t('private.privateMessages') }}</h2>
        <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
        <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    props: ['feedId'],

    data: function() {
      var self = this
      return {
        postMessageVisible: false,
        postText: "",
        subject: "",
        people: [],
        recipients: [],
        messages: [],
        editorOptions: {
          usageStatistics: false,
          hideModeSwitch: true,
          initialEditType: 'markdown',
          hooks: {
            addImageBlobHook: self.addImageBlobHook
          },
          customHTMLRenderer: {
            image(node, context) {
              const { destination } = node
              const { getChildrenText, skipChildren } = context

              skipChildren()

              return {
                type: "openTag",
                tagName: "img",
                selfClose: true,
                attributes: {
                  src: self.blobUrlCache[destination],
                  alt: getChildrenText(node)
                }
              }
            }
          }
        },
        blobUrlCache: [],

        showPreview: false
      }
    },

    methods: {
      suggest: function(searchString, loading) {
        var self = this
        loading(true)
        let searchOpts = {}
        if (searchString !== "")
          searchOpts['text'] = searchString 

        SSB.net.suggest.profile(searchOpts, (err, matches) => {
          self.people = []
          if (matches) {
            matches.forEach(match => {
              const p = SSB.getProfile(match.id)
              if (p && p.imageURL)
                self.people.push({ id: match.id, name: match.name, image: p.imageURL })
              else
                self.people.push({ id: match.id, name: match.name, image: helpers.getMissingProfileImage() })
            })
          }

          loading(false)
        })
      },

      recipientsOpen: function() {
        var self = this
        SSB.net.suggest.profile({}, (err, matches) => {
          if (matches) {
            self.people = []
            matches.forEach(match => {
              const p = SSB.getProfile(match.id)
              if (p && p.imageURL)
                self.people.push({ id: match.id, name: match.name, image: p.imageURL })
              else
                self.people.push({ id: match.id, name: match.name, image: helpers.getMissingProfileImage() })
            })
          }
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
          descending(),
          toCallback((err, results) => {
            this.messages = results
            console.timeEnd("private messages")

            if (!self.feedId || self.feedId == '')
              document.body.classList.remove('refreshing')
          })
        )
      },

      addImageBlobHook: function(blob, cb) {
        var self = this
        helpers.handleFileSelectParts([ blob ], true, (err, res) => {
          var link = ref.parseLink(res.link)
          if (link.query && link.query.unbox) {
            // Have to unbox it first.
            SSB.net.blobs.privateGet(link.link, link.query.unbox, (err, newLink) => {
              self.blobUrlCache[res.link] = newLink
              cb(res.link, res.name)
            })
          } else {
            SSB.net.blobs.privateFsURL(res.link, (err, blobURL) => {
              self.blobUrlCache[res.link] = blobURL
              cb(res.link, res.name)
            })
          }
        })
        return false
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
        var self = this

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
          if (self.$refs.tuiEditor)
            self.$refs.tuiEditor.invoke('setMarkdown', this.descriptionText)

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
