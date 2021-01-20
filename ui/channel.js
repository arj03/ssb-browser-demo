module.exports = function () {
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const { and, or, channel, isPublic, type, descending, startFrom, paginate, toCallback } = SSB.dbOperators

  return {
    template: `
       <div id="channel">
         <h2>{{ $t('channel.title', { name: channel }) }}</h2>
         <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
         <button class="clickButton" id="postMessage" v-on:click="onPost">{{ $t('channel.postNewMessage') }}</button>
         <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">

         <h2>{{ $t('common.lastXMessages', { count: pageSize }) }}
         <a href="javascript:void(0);" :title="$t('common.refreshMessages')" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
         </h2>

         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <p v-if="messages.length == 0">{{ $t('common.noMessages') }}</p>
         <p>{{ $t('common.showingMessagesFrom') }} 1-{{ displayPageEnd }}<br />
         <button class="clickButton" v-on:click="loadMore">{{ $t('common.loadXMore', { count: pageSize }) }}</button>
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
        autorefreshTimer: 0,
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

      onScroll: function() {
        const scrollTop = (typeof document.body.scrollTop != 'undefined' ? document.body.scrollTop : window.scrollY)

        if (scrollTop == 0) {
          // At the top of the page.  Enable autorefresh
          var self = this
          this.autorefreshTimer = setTimeout(() => {
            self.autorefreshTimer = 0
            self.onScroll()
            self.refresh()
          }, (this.messages.length > 0 ? 30000 : 3000))
        } else {
          clearTimeout(this.autorefreshTimer)
          this.autorefreshTimer = 0
        }
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
        console.log("Refreshing")
        this.messages = []
        this.offset = 0
        this.render()
      }
    },

    created: function () {
      window.addEventListener('scroll', this.onScroll)
      this.onScroll()
      this.render()
    },

    destroyed: function() {
      window.removeEventListener('scroll', this.onScroll)
    }
  }
}
