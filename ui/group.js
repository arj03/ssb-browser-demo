module.exports = function () {
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')
  const userGroups = require('../usergroups')

  return {
    template: `
       <div id="group">
         <h2>{{ $t('group.title', { name: groupName }) }}</h2>
         <markdown-editor v-if="postMessageVisible" :initialValue="postText" ref="markdownEditor" />
         <button class="clickButton" id="postMessage" v-on:click="onPost">{{ $t('channel.postNewMessage') }}</button>
         <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">

         <h2>{{ $t('common.lastXMessages', { count: pageSize }) }}
         <a href="javascript:void(0);" :title="$t('common.refreshMessages')" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
         </h2>

         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <p v-if="messages.length == 0 && !triedToLoadMessages">{{ $t('common.searchingForMessages') }}</p>
         <p v-if="messages.length == 0 && triedToLoadMessages">{{ $t('common.noMessages') }}</p>
         <p>{{ $t('common.showingMessagesFrom') }} 1-{{ displayPageEnd }}<br />
         <button class="clickButton" v-on:click="loadMore">{{ $t('common.loadXMore', { count: pageSize }) }}</button>
         </p>
         <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
       <div>`,

    props: ['group'],
    
    data: function() {
      return {
        componentStillLoaded: false,
        groupName: "Loading...",
        groupMembers: [],
        postMessageVisible: false,
        postText: "",
        offset: 0,
        pageSize: 50,
        displayPageEnd: 50,
        autorefreshTimer: 0,
        showPreview: false,
        triedToLoadMessages: false,
        messages: []
      }
    },

    methods: {
      loadMore: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.loadMoreCB)
      },

      loadMoreCB: function(err, SSB) {
        const { where, and, or, author, isPublic, type, descending, startFrom, paginate, toCallback } = SSB.dbOperators
        try {
          SSB.db.query(
            where(
              and(
                or(...this.groupMembers.map(x => author(x))),
                isPublic(),
                type('post')
              )
            ),
            descending(),
            startFrom(this.offset),
            paginate(this.pageSize),
            toCallback((err, answer) => {
              this.triedToLoadMessages = true
              this.messages = this.messages.concat(answer.results)
              this.displayPageEnd = this.offset + this.pageSize
              this.offset += this.pageSize // If we go by result length and we have filtered out all messages, we can never get more.
            })
          )
        } catch(e) {
          // Probably no messages and crashed the query with "TypeError: Cannot set property 'meta' of undefined"
          this.triedToLoadMessages = true
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

        this.postText = this.$refs.markdownEditor.getMarkdown()

        // Make sure the full post (including headers) is not larger than the 8KiB limit.
        var postData = this.buildPostData()
        if (JSON.stringify(postData).length > 8192) {
          alert(this.$root.$t('common.postTooLarge'))
          return
        }

        if (this.postText == '') {
          alert(this.$root.$t('channel.blankFieldError'))
          return
        }

        this.showPreview = true
      },

      buildPostData: function() {
        var mentions = ssbMentions(this.postText)

        var postData = { type: 'post', text: this.postText, mentions: mentions }

        return postData
      },

      confirmPost: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.db) {
          alert("Can't post right now.  Couldn't lock the database.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

        var self = this

        var postData = this.buildPostData()

        SSB.db.publish(postData, (err) => {
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
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('group.title', { name: this.groupName })

      var self = this
      userGroups.getGroups((err, groups) => {
        for (g in groups) {
          if (groups[g].id == self.group)
            self.groupName = groups[g].name
        }
      })
      userGroups.getMembers(self.group, (err, groupId, members) => {
        self.groupMembers = members
        this.render()
      })
    },

    destroyed: function () {
      this.componentStillLoaded = false
    },

    watch: {
      groupName: function(oldVal, newVal) {
        document.title = this.$root.appTitle + " - " + this.$root.$t('group.title', { name: this.groupName })
      }
    }
  }
}
