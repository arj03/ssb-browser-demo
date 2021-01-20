module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')
  const localPrefs = require('../localprefs')
  const { and, or, isRoot, isPublic, type, author, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  function getQuery(onlyDirectFollow, onlyThreads) {
    let feedFilter = null
    if (onlyDirectFollow) {
      const graph = SSB.db.getIndex('contacts').getGraphForFeedSync(SSB.net.id)
      feedFilter = or(...graph.following.map(x => author(x)))
    }

    if (onlyThreads)
      return and(type('post'), isRoot(), isPublic(), feedFilter)
    else
      return and(type('post'), isPublic(), feedFilter)
  }

  return {
    template: `
    <div id="public">
      <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
      <button class="clickButton" id="postMessage" v-on:click="onPost">Post new thread</button>
      <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
      <h2>Last {{ pageSize }} messages
      <a href="javascript:void(0);" title="Refresh messages" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
      </h2>
      <fieldset><legend>Filters</legend>
      <input id='onlyDirectFollow' type='checkbox' v-model="onlyDirectFollow"> <label for='onlyDirectFollow'>Only show posts from people you follow</label><br />
      <input id='onlyThreads' type='checkbox' v-model="onlyThreads"> <label for='onlyThreads'>Hide replies (only show the first message of a thread)</label>
      </fieldset>
      <br>
      <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
      <p v-if="messages.length == 0">(No messages to display)</p>
      <p>Showing messages from 1-{{ displayPageEnd }}<br />
      <button class="clickButton" v-on:click="loadMore">Load {{ pageSize }} more</button>
      </p>
      <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
      <onboarding-dialog v-bind:show="showOnboarding" v-bind:onClose="closeOnboarding"></onboarding-dialog>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        onlyDirectFollow: false,
        onlyThreads: false,
        messages: [],
        offset: 0,
        pageSize: 50,
        displayPageEnd: 50,
        autorefreshTimer: 0,

        showOnboarding: window.firstTimeLoading,
        showPreview: false
      }
    },

    methods: {
      loadMore: function() {
        SSB.db.query(
          getQuery(this.onlyDirectFollow, this.onlyThreads),
          startFrom(this.offset),
          paginate(this.pageSize),
          descending(),
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

      closeOnboarding: function() {
        this.showOnboarding = false

        // We're set up.  We don't need this anymore and don't want it popping back up next time Public is loaded.
        window.firstTimeLoading = false
      },

      renderPublic: function () {
        componentsState.newPublicMessages = false

        document.body.classList.add('refreshing')

        console.time("latest messages")

        SSB.db.query(
          getQuery(this.onlyDirectFollow, this.onlyThreads),
          startFrom(this.offset),
          paginate(this.pageSize),
          descending(),
          toCallback((err, answer) => {
            document.body.classList.remove('refreshing')
            console.timeEnd("latest messages")

            if (err) {
              this.messages = []
              alert("An exception was encountered trying to read the messages database.  Please report this so we can try to fix it: " + err)
              throw err
            } else {
              this.messages = this.messages.concat(answer.results)
              this.displayPageEnd = this.offset + this.pageSize
              this.offset += this.pageSize // If we go by result length and we have filtered out all messages, we can never get more.
            }
          })
        )
      },

      saveFilters: function() {
        var filterNames = [];
        if(this.onlyDirectFollow)
          filterNames.push('onlydirectfollow')

        if(this.onlyThreads)
          filterNames.push('onlythreads')

        // If we have no filters, set it to 'none' since we don't have a filter named that and it will keep it from dropping down to default.
        localPrefs.setPublicFilters(filterNames.length > 0 ? filterNames.join('|') : 'none')
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

        SSB.db.publish({ type: 'post', text: this.postText, mentions: mentions }, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.postMessageVisible = false
          self.showPreview = false

          self.renderPublic()
        })
      },

      refresh: function() {
        console.log("Refreshing")
        this.messages = []
        this.offset = 0
        this.renderPublic()
      }
    },

    created: function () {
      window.addEventListener('scroll', this.onScroll)
      this.onScroll()

      // Pull preferences for filters.
      const filterNamesSeparatedByPipes = localPrefs.getPublicFilters();
      this.onlyDirectFollow = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlydirectfollow') >= 0)
      this.onlyThreads = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlythreads') >= 0)

      this.renderPublic()
    },

    destroyed: function () {
      window.removeEventListener('scroll', this.onScroll)
    },

    watch: {
      onlyDirectFollow: function (newValue, oldValue) {
        if (newValue === '') return
        this.refresh()
      },

      onlyThreads: function (newValue, oldValue) {
        if (newValue === '') return
        this.refresh()
      }
    }
  }
}
