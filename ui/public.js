module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')

  function getQuery(onlyThreads) {
    var query = {
      type: 'EQUAL',
      data: {
        seek: SSB.db.jitdb.seekType,
        value: Buffer.from('post'),
        indexType: "type"
      }
    }

    if (onlyThreads) {
      query = {
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
            seek: SSB.db.jitdb.seekRoot,
            value: undefined,
            indexType: "root"
          }
        }]
      }
    }

    return query
  }

  return {
    template: `
    <div id="public">
      <div class="refresher">
         <img src="hermies.png">
      </div>
      <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
      <button class="clickButton" id="postMessage" v-on:click="onPost">Post new thread</button>
      <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
      <button class="clickButton" id="syncData" v-on:click="syncData">Sync data</button><br>
      <h2>Last 50 messages</h2>
      Threads only: <input id='onlyThreads' type='checkbox' v-model="onlyThreads">
      <br>
      <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
      <button class="clickButton" v-on:click="loadMore">Load more</button>
      <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        onlyThreads: false,
        messages: [],
        offset: 0,

        showPreview: false
      }
    },

    methods: {
      syncData: function(ev) {
        if (SSB.db.getStatus().log == -1)
          alert("Nothing to sync, try following a profile first!")
        else
          SSB.sync()
      },

      loadMore: function() {
        SSB.db.jitdb.query(getQuery(this.onlyThreads), this.offset, 25, (err, results) => {
          this.messages = this.messages.concat(results.filter(msg => !msg.value.meta))
          this.offset += results.length
        })
      },

      renderPublic: function () {
        componentsState.newPublicMessages = false

        SSB.db.jitdb.onReady(() => {
          console.time("latest messages")
          SSB.db.jitdb.query(getQuery(this.onlyThreads), this.offset, 25, (err, results) => {
            this.messages = results.filter(msg => !msg.value.meta)
            this.offset += results.length
            console.timeEnd("latest messages")
          })
        })
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
