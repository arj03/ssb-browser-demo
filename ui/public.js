module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const throttle = require('lodash.throttle')
  const ssbMentions = require('ssb-mentions')
  const localPrefs = require('../localprefs')
  const { and, or, not, channel, isRoot, isPublic, type, author, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  function getQuery(onlyDirectFollow, onlyThreads, onlyChannels, channelList) {
    let feedFilter = null
    if (onlyDirectFollow) {
      const graph = SSB.db.getIndex('contacts').getGraphForFeedSync(SSB.net.id)
      feedFilter = or(...graph.following.map(x => author(x)))
    }

    let channelFilter = null
    if (onlyChannels) {
      channelFilter = or(...channelList.map(x => channel(x.replace(/^#+/, ''))))
    }

    if (onlyThreads)
      return and(type('post'), isRoot(), isPublic(), feedFilter, channelFilter)
    else
      return and(type('post'), isPublic(), feedFilter, channelFilter)
  }

  return {
    template: `
    <div id="public">
      <div class="new-message">
        <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
        <button class="clickButton" id="postMessage" v-on:click="onPost">{{ $t('public.postNewThread') }}</button>
        <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <div class="channel-selector" v-if="postMessageVisible"><v-select :placeholder="$t('public.channelOptional')" v-model="postChannel" :options="channels" taggable>
        </v-select></div>
      </div>
      <h2>{{ $t('common.lastXMessages', { count: pageSize }) }}
      <a href="javascript:void(0);" :title="$t('common.refreshMessages')" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
      </h2>
      <fieldset><legend>{{ $t('public.filters') }}</legend>
      <input id='onlyDirectFollow' type='checkbox' v-model="onlyDirectFollow"> <label for='onlyDirectFollow'>{{ $t('public.filterOnlyDirectFollow') }}</label><br />
      <input id='onlyThreads' type='checkbox' v-model="onlyThreads"> <label for='onlyThreads'>{{ $t('public.filterOnlyThreads') }}</label><br />
      <input id='onlyChannels' type='checkbox' v-model="onlyChannels"> <label for='onlyChannels'>{{ $t('public.filterOnlyChannels') }}</label>
      <div class="channel-selector"><v-select :placeholder="$t('public.channelsOptional')" v-model="onlyChannelsList" :options="channels" taggable multiple push-tags>
      </v-select></div>
      </fieldset>
      <br>
      <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
      <p v-if="messages.length == 0">{{ $t('common.noMessages') }}</p>
      <p>{{ $t('common.showingMessagesFrom') }} 1-{{ displayPageEnd }}<br />
      <button class="clickButton" v-on:click="loadMore">{{ $t('common.loadXMore', { count: pageSize }) }}</button>
      </p>
      <ssb-msg-preview v-bind:show="showPreview" v-bind:text="postText" v-bind:onClose="closePreview" v-bind:confirmPost="confirmPost"></ssb-msg-preview>
      <onboarding-dialog v-bind:show="showOnboarding" v-bind:onClose="closeOnboarding"></onboarding-dialog>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        postChannel: "",
        channels: [],
        onlyDirectFollow: false,
        onlyThreads: false,
        onlyChannels: false,
        onlyChannelsList: [],
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
          getQuery(this.onlyDirectFollow, this.onlyThreads, this.onlyChannels, this.onlyChannelsList),
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
          getQuery(this.onlyDirectFollow, this.onlyThreads, this.onlyChannels, this.onlyChannelsList),
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

        if(this.onlyChannels)
          filterNames.push('onlychannels')

        // If we have no filters, set it to 'none' since we don't have a filter named that and it will keep it from dropping down to default.
        localPrefs.setPublicFilters(filterNames.length > 0 ? filterNames.join('|') : 'none')
        localPrefs.setFavoriteChannels(this.onlyChannelsList)
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

      channelResultCallback: function(err, answer) {
        if (!err) {
          var newChannels = []

          var posts = (answer.results ? answer.results : answer);

          for (r in posts) {
            var channel = posts[r].value.content.channel

            if(channel && channel.charAt(0) == '#')
              channel = channel.substring(1, channel.length)

            if (channel && channel != '' && channel != '"')
              if (newChannels.indexOf(channel) < 0)
                newChannels.push(channel)
          }

          // Sort and add a # at the start so it displays like it would normally for a user.
          var sortFunc = Intl.Collator().compare
          this.channels = newChannels.map((x) => '#' + x).sort(sortFunc)
        }
      },

      loadChannels: function() {
        if (this.channels.length == 0) {
          // Load the list of channels.
          var self = this
          SSB.connectedWithData((rpc) => {
            SSB.db.query(
              and(not(channel('')), type('post'), isPublic()),
              toCallback(self.channelResultCallback)
            )
          })
        }
      },

      onPost: function() {
        if (!this.postMessageVisible) {
          this.postMessageVisible = true
          return
        }

        if(this.postChannel && this.postChannel != '') {
          // Exceedingly basic validation.
          // FIXME: Validate this properly.  We would need a list of characters which are valid for channels.
          if(this.postChannel.indexOf(' ') >= 0) {
            alert(this.$root.$t('public.channelsCannotContainSpaces'))
            return
          }
        }

        this.showPreview = true
      },

      confirmPost: function() {
        var self = this

        var mentions = ssbMentions(this.postText)

        var postData = { type: 'post', text: this.postText, mentions: mentions }

        if(this.postChannel && this.postChannel != '') {
          postData.channel = this.postChannel.replace(/^#+/, '')
        }

        SSB.db.publish(postData, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.postChannel = ""
          self.postMessageVisible = false
          self.showPreview = false

          self.refresh()
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
      document.title = this.$root.appTitle + " - " + this.$root.$t('public.title')

      window.addEventListener('scroll', this.onScroll)
      this.onScroll()

      // Pull preferences for filters.
      const filterNamesSeparatedByPipes = localPrefs.getPublicFilters();
      this.onlyDirectFollow = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlydirectfollow') >= 0)
      this.onlyThreads = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlythreads') >= 0)
      this.onlyChannels = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlychannels') >= 0)
      this.onlyChannelsList = localPrefs.getFavoriteChannels()

      this.renderPublic()

      // Start this loading to make it easier for the user to filter by channels.
      this.loadChannels()
    },

    destroyed: function () {
      window.removeEventListener('scroll', this.onScroll)
    },

    watch: {
      onlyDirectFollow: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      },

      onlyChannels: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      },

      onlyChannelsList: function (newValue, oldValue) {
        this.saveFilters()

        // Only refresh if it changed while the checkbox is checked.
        if (this.onlyChannels)
          this.refresh()
      },

      onlyThreads: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      }
    }
  }
}
