module.exports = function () {
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const { and, or, channel, isPublic, type, descending, startFrom, paginate, toCallback } = SSB.dbOperators

  return {
    template: `
       <div id="channel">
         <h2>Channel #{{ channel }}</h2>
         <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
         <button class="clickButton" id="postMessage" v-on:click="onPost">Post new message</button>
         <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">

         <h2>Last {{ pageSize }} messages
         <a href="javascript:void(0);" title="Refresh messages" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
         </h2>

         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <p v-if="messages.length == 0">(No messages to display)</p>
         <p>Showing messages from 1-{{ displayPageEnd }}<br />
         <button class="clickButton" v-on:click="loadMore">Load {{ pageSize }} more</button>
         </p>
         <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        offset: 0,
        pageSize: 50,
        displayPageEnd: 50,
        showPreview: false,
        messages: []
      }
    },

    methods: {
      loadMore: function() {
        SSB.db.query(
          and(or(channel(this.channel), channel("#" + this.channel)), isPublic()),
          and(type('post')),
          descending(),
          startFrom(this.offset),
          paginate(this.pageSize),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results)
            this.displayPageEnd = this.offset + this.pageSize
            this.offset += this.pageSize // If we go by result length and we have filtered out all messages, we can never get more.
          })
        )
      },

      render: function () {
        this.loadMore()
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

        SSB.db.publish({ type: 'post', channel: this.channel, text: this.postText, mentions: mentions }, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.postMessageVisible = false
          self.showPreview = false

          self.refresh()
        })
      },

      refresh: function() {
        this.messages = []
        this.offset = 0
        this.render()
      }
    },

    created: function () {
      this.render()
    },
  }
}
