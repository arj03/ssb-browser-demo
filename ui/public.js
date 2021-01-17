module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')
  const { and, isRoot, isPublic, type, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  function getQuery(onlyThreads) {
    if (onlyThreads)
      return and(type('post'), isRoot(), isPublic())
    else
      return and(type('post'), isPublic())
  }

  return {
    template: `
    <div id="public">
      <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
      <button class="clickButton" id="postMessage" v-on:click="onPost">Post new thread</button>
      <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
      <h2>Last 50 messages</h2>
      <fieldset><legend>Filters</legend>
      <input id='onlyDirectFollow' type='checkbox' v-model="onlyDirectFollow"> <label for='onlyDirectFollow'>Only show posts from people you follow</label><br />
      <input id='onlyThreads' type='checkbox' v-model="onlyThreads"> <label for='onlyThreads'>Hide replies (only show the first message of a thread)</label>
      </fieldset>
      <br>
      <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
      <button class="clickButton" v-on:click="loadMore">Load more</button>
      <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
	onlyDirectFollow: false,
        onlyThreads: false,
        messages: [],
        offset: 0,

        showPreview: false
      }
    },

    methods: {
      filterResultsByFollow: function(rawResults) {
        if(!this.onlyDirectFollow)
          return rawResults

        // Filter out any results from people our profile doesn't follow.
        var filtered = []
        const contacts = SSB.db.getIndex('contacts')
        for(r in rawResults)
          if(contacts.isFollowing(SSB.net.id, rawResults[r].value.author))
            filtered.push(rawResults[r])

        return filtered
      },

      loadMore: function() {
        SSB.db.query(
          getQuery(this.onlyThreads),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            const results = this.filterResultsByFollow(answer.results)
            this.messages = this.messages.concat(results)
            this.offset += results.length
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
	    if(!err) {
              const results = this.filterResultsByFollow(answer.results)
              this.messages = this.messages.concat(results)
              this.offset += results.length
	    }
            document.body.classList.remove('refreshing')
            console.timeEnd("latest messages")
	    if(err) {
	      this.messages = [];
	      alert("An exception was encountered trying to read the messages database.  Please report this so we can try to fix it: " + err);
	      throw err;
	    }
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

        SSB.db.publish({ type: 'post', text: this.postText, mentions: mentions }, (err) => {
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
      onlyDirectFollow: function (newValue, oldValue) {
        this.messages = []
        this.offset = 0
        this.renderPublic()
      },

      onlyThreads: function (newValue, oldValue) {
        this.messages = []
        this.offset = 0
        this.renderPublic()
      }
    }
  }
}
