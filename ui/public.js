module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')
  const { and, isRoot, type, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  function getQuery(onlyThreads) {
    if (onlyThreads)
      return and(type('post'), isRoot())
    else
      return and(type('post'))
  }

  return {
    template: `
    <div id="public">
      <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
      <button class="clickButton" id="postMessage" v-on:click="onPost">Post new thread</button>
      <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
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
      loadMore: function() {
        SSB.db.query(
          getQuery(this.onlyThreads),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results.filter(msg => !msg.value.meta))
            this.offset += answer.results.length
          })
        )
      },

      renderPublic: function () {
        componentsState.newPublicMessages = false

        document.body.classList.add('refreshing')

        console.time("latest messages")
        
        SSB.db.query(
          getQuery(this.onlyThreads),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results.filter(msg => !msg.value.meta))
            this.offset += answer.results.length
            document.body.classList.remove('refreshing')
            console.timeEnd("latest messages")
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
    },

    created: function () {
      this.renderPublic()
    },

    watch: {
      onlyThreads: function (newValue, oldValue) {
        this.messages = []
        this.offset = 0
        this.renderPublic()
      }
    }
  }
}
