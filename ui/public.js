module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')

  return {
    template: `
    <div id="public">
      <div class="refresher">
         <img src="hermies.png">
      </div>
      <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
      <button class="clickButton" id="postMessage" v-on:click="onPost">Post new thread</button>
      <button class="clickButton" id="syncData" v-on:click="syncData">Sync data</button><br>
      <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
      <h2>Last 50 messages</h2>
      Threads only: <input id='onlyThreads' type='checkbox' v-model="onlyThreads">
      <br>
      <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
      <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        onlyThreads: false,
        messages: [],

        showPreview: false
      }
    },

    methods: {
      syncData: function(ev) {
        if (SSB.db.getStatus().sync == false)
          alert("Nothing to sync, write a message or use invites tab for onboarding")
        else
          SSB.sync()
      },

      renderPublic: function () {
        componentsState.newPublicMessages = false

        return // FIXME

        let contentFilter = { type: 'post' }
        if (this.onlyThreads)
          contentFilter["root"] = undefined

        pull(
          SSB.db.query.read({
            reverse: true,
            limit: 50,
            query: [{
              $filter: {
                value: {
                  timestamp: { $gt: 0 },
                  //author: '@VIOn+8a/vaQvv/Ew3+KriCngyUXHxHbjXkj4GafBAY0=.ed25519'
                  content: contentFilter
                }
              }
            }]
          }),
          pull.filter((msg) => !msg.value.meta),
          pull.collect((err, msgs) => {
            this.messages = msgs
          })
        )
      },

      onFileSelect: function(ev) {
        var self = this
        helpers.handleFileSelect(ev, false, (err, text) => {
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

        this.showPreview = true
      },

      confirmPost: function() {
        var self = this

        var mentions = ssbMentions(this.postText)

        SSB.publish({ type: 'post', text: this.postText, mentions: mentions }, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.postMessageVisible = false
          self.showPreview = false

          self.renderPublic()
        })
      },

      enablePullToRefresh: function() {
        let startY
        const public = document.querySelector('#public')

        public.addEventListener('touchstart', e => {
          startY = e.touches[0].pageY;
        }, { passive: true })

        var self = this

        const throttledSync = throttle(() => {
          SSB.sync()

          setTimeout(() => {
            if (componentsState.newPublicMessages) {
              self.renderPublic()
            }
          }, 2000)
        }, 500)

        public.addEventListener('touchmove', e => {
          if (document.scrollingElement.scrollTop === 0 && e.touches[0].pageY > startY &&
              !document.body.classList.contains('refreshing')) {

            document.body.classList.add('refreshing')

            setTimeout(() => {
              document.body.classList.remove('refreshing')
            }, 1000)

            throttledSync()
          }
        }, { passive: true })
      }
    },

    created: function () {
      this.renderPublic()
    },

    mounted: function() {
      this.enablePullToRefresh()
    },
    
    watch: {
      onlyThreads: function (newValue, oldValue) {
        this.renderPublic()
      }
    }
  }
}
