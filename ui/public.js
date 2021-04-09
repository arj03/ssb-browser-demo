module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const ssbMentions = require('ssb-mentions')
  const localPrefs = require('../localprefs')
  const userGroups = require('../usergroups')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  function getQuery(SSB, onlyDirectFollow, onlyThreads, onlyChannels,
                    channelList, hideChannels, hideChannelsList, onlyGroups, onlyGroupsList, cb) {

    const { and, or, not, channel, isRoot, isPublic, type, author } = SSB.dbOperators
    let feedFilter = null
    if (onlyDirectFollow) {
      const graph = SSB.getGraphSync()
      if (graph.following.length > 0)
        feedFilter = or(...graph.following.map(x => author(x)))
    }

    let channelFilter = null
    if (onlyChannels && channelList.length > 0)
      channelFilter = or(...channelList.map(x => channel(x.replace(/^#+/, ''))))

    let hideChannelFilter = null
    if (hideChannels && hideChannelsList.length > 0)
      hideChannelFilter = and(...hideChannelsList.map(x => not(channel(x.replace(/^#+/, '')))))

    let groupFilter = null
    if (onlyGroups && onlyGroupsList.length > 0) {
      // Groups are asynchronous, so we've got as many async calls to
      // make as we have groups to look for, so this is going to take
      // some work.
      let needGroupMembersFor = onlyGroupsList.length
      let allMembers = []
      for (g in onlyGroupsList) {
        userGroups.getMembers(onlyGroupsList[g].id, (err, groupId, members) => {
          allMembers = allMembers.concat(members)
          --needGroupMembersFor
          if (needGroupMembersFor == 0) {
            // We finally have all the group members we need, so we can put together the query.
            var uniqueMembers = allMembers.filter((x, index, self) => { return self.indexOf(x) === index }) // See https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
            var groupFilter = or(...uniqueMembers.map(x => author(x)))
            if (onlyThreads)
              cb(null, and(or(type('post'), type('about')), isRoot(), isPublic(), feedFilter, channelFilter, hideChannelFilter, groupFilter))
            else
              cb(null, and(or(type('post'), type('about')), isPublic(), feedFilter, channelFilter, hideChannelFilter, groupFilter))
          }
        })
      }
    } else {
      if (onlyThreads)
        cb(null, and(or(type('post'), type('about')), isRoot(), isPublic(), feedFilter, channelFilter, hideChannelFilter))
      else
        cb(null, and(or(type('post'), type('about')), isPublic(), feedFilter, channelFilter, hideChannelFilter))
    }
  }

  return {
    template: `
    <div id="public">
      <div class="new-message">
        <span v-if="postMessageVisible"><input type="text" class="messageTitle" v-model="postTitle" :placeholder="$t('public.threadTitlePlaceholder')" /><br /></span>
        <markdown-editor v-if="postMessageVisible" :initialValue="postText" ref="markdownEditor" />
        <button class="clickButton" id="postMessage" v-on:click="onPost">{{ $t('public.postNewThread') }}</button>
        <input type="file" class="fileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <div class="channel-selector" v-if="postMessageVisible"><v-select :placeholder="$t('public.channelOptional')" v-model="postChannel" :options="channels" taggable>
        </v-select></div>
      </div>
      <h2>{{ $t('common.lastXMessages', { count: pageSize }) }}
      <a href="javascript:void(0);" :title="$t('common.refreshMessages')" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
      </h2>
      <button v-if="!showFilters" class="clickButton" v-on:click="clickShowFilters">{{ $t('public.showFilters') }}</button>
      <button v-if="showFilters" class="clickButton" v-on:click="clickHideFilters">{{ $t('public.hideFilters') }}</button>
      <fieldset v-if="showFilters"><legend>{{ $t('public.filters') }}</legend>
      <input id='onlyDirectFollow' type='checkbox' v-model="onlyDirectFollow"> <label for='onlyDirectFollow'>{{ $t('public.filterOnlyDirectFollow') }}</label><br />
      <input id='onlyThreads' type='checkbox' v-model="onlyThreads"> <label for='onlyThreads'>{{ $t('public.filterOnlyThreads') }}</label><br />
      <div class='filter-line'>
        <input id='onlyChannels' type='checkbox' v-model="onlyChannels"> <label for='onlyChannels'>{{ $t('public.filterOnlyChannels') }}</label>
        <div class="channel-selector"><v-select :placeholder="$t('public.channelsOptional')" v-model="onlyChannelsList" :options="channels" taggable multiple push-tags>
        </v-select></div>
      </div>
      <div class='filter-line'>
        <input id='hideChannels' type='checkbox' v-model="hideChannels"> <label for='hideChannels'>{{ $t('public.filterHideChannels') }}</label>
        <div class="channel-selector"><v-select :placeholder="$t('public.channelsOptional')" v-model="hideChannelsList" :options="channels" taggable multiple push-tags>
        </v-select></div>
      </div>
      <div class='filter-line'>
        <input id='onlyGroups' type='checkbox' v-model="onlyGroups"> <label for='onlyGroups'>{{ $t('public.filterOnlyGroups') }}</label>
        <div class="channel-selector"><v-select :placeholder="$t('public.groupsOptional')" v-model="onlyGroupsList" :options="groups" multiple>
        </v-select></div>
      </div>
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
      var self = this
      return {
        postMessageVisible: false,
        postTitle: "",
        postText: "",
        postChannel: "",
        channels: [],
        groups: [],
        showFilters: false,
        onlyDirectFollow: false,
        onlyThreads: false,
        onlyChannels: false,
        onlyChannelsList: [],
        hideChannels: false,
        hideChannelsList: [],
        onlyGroups: false,
        onlyGroupsList: [],
        messages: [],
        offset: 0,
        pageSize: 50,
        displayPageEnd: 50,
        autorefreshTimer: 0,
        isRefreshing: false,
        componentStillLoaded: false,

        showOnboarding: window.firstTimeLoading,
        showPreview: false
      }
    },

    methods: {
      clickShowFilters: function() {
        this.showFilters = true
      },

      clickHideFilters: function() {
        this.showFilters = false
      },

      loadMore: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.loadMoreCB)
      },

      loadMoreCB: function(err, SSB) {
        var self = this

        const { where, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        getQuery(SSB, this.onlyDirectFollow, this.onlyThreads,
          this.onlyChannels, this.onlyChannelsList,
          this.hideChannels, this.hideChannelsList,
          this.onlyGroups, this.onlyGroupsList,
          (err, query) => {
          SSB.db.query(
            where(query),
            startFrom(self.offset),
            paginate(self.pageSize),
            descending(),
            toCallback((err, answer) => {
              if (answer && answer.results) {
                self.messages = self.messages.concat(answer.results)
                self.displayPageEnd = self.offset + self.pageSize
                self.offset += self.pageSize // If we go by result length and we have filtered out all messages, we can never get more.
              }
            })
          )
        })
      },

      closeOnboarding: function() {
        this.showOnboarding = false

        // We're set up.  We don't need this anymore and don't want it popping back up next time Public is loaded.
        window.firstTimeLoading = false
      },

      renderPublic: function () {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.renderPublicCB)
      },

      renderPublicCB: function(err, SSB) {
        var self = this

        const { where, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        componentsState.newPublicMessages = false

        this.isRefreshing = true
        document.body.classList.add('refreshing')

        console.time("latest messages")

        getQuery(SSB, this.onlyDirectFollow, this.onlyThreads,
          this.onlyChannels, this.onlyChannelsList,
          this.hideChannels, this.hideChannelsList,
          this.onlyGroups, this.onlyGroupsList,
          (err, query) => {
          SSB.db.query(
            where(query),
            startFrom(self.offset),
            paginate(self.pageSize),
            descending(),
            toCallback((err, answer) => {
              self.isRefreshing = false
              document.body.classList.remove('refreshing')
              console.timeEnd("latest messages")
  
              if (err) {
                self.messages = []
                alert("An exception was encountered trying to read the messages database.  Please report this so we can try to fix it: " + err)
                throw err
              } else if (answer && answer.results) {
                self.messages = self.messages.concat(answer.results)
                self.displayPageEnd = self.offset + self.pageSize
                self.offset += self.pageSize // If we go by result length and we have filtered out all messages, we can never get more.
              }
            })
          )
        })
      },

      saveFilters: function() {
        var filterNames = [];
        if(this.onlyDirectFollow)
          filterNames.push('onlydirectfollow')

        if(this.onlyThreads)
          filterNames.push('onlythreads')

        if(this.onlyChannels)
          filterNames.push('onlychannels')

        if(this.hideChannels)
          filterNames.push('hidechannels')

        if(this.onlyGroups)
          filterNames.push('onlygroups')

        // If we have no filters, set it to 'none' since we don't have a filter named that and it will keep it from dropping down to default.
        localPrefs.setPublicFilters(filterNames.length > 0 ? filterNames.join('|') : 'none')
        localPrefs.setFavoriteChannels(this.onlyChannelsList)
        localPrefs.setHiddenChannels(this.hideChannelsList)
        localPrefs.setFavoriteGroups(this.onlyGroupsList.map((x) => x.id))
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

      loadChannels: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.loadChannelsCB)
      },

      loadChannelsCB: function(err, SSB) {
        const allChannels = SSB.db.getIndex("channels").getChannels()
        const sortFunc = (new Intl.Collator()).compare
        const filteredChannels = allChannels.sort(sortFunc)
        this.channels = filteredChannels.map((x) => "#" + x)
      },

      loadGroups: function() {
        userGroups.getGroups((err, groups) => {
          const sortFunc = (new Intl.Collator()).compare
          this.groups = groups.sort((a, b) => { return sortFunc(a.name, b.name) })
            .map((x) => { return { label: x.name, id: x.id } })
        })
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
        
        this.postText = this.$refs.markdownEditor.getMarkdown()

        // Make sure the full post (including headers) is not larger than the 8KiB limit.
        var postData = this.buildPostData()
        if (JSON.stringify(postData).length > 8192) {
          alert(this.$root.$t('common.postTooLarge'))
          return
        }

        if (this.postText == '') {
          alert(this.$root.$t('public.blankFieldError'))
          return
        }

        this.showPreview = true
      },

      buildPostData: function() {
        var mentions = ssbMentions(this.postText)

        var postData = { type: 'post', text: this.postText, mentions: mentions }
        
        if (this.postTitle && this.postTitle.trim() != '')
          postData.title = this.postTitle.trim()

        if(this.postChannel && this.postChannel != '') {
          postData.channel = this.postChannel.replace(/^#+/, '')
        }

        return postData
      },

      confirmPost: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.db) {
          alert("Can't post right now.  Couldn't lock database.  Please make sure you only have one instance off ssb-browser running.")
          return
        }

        var self = this

        var postData = this.buildPostData()

        SSB.db.publish(postData, (err) => {
          if (err) console.log(err)

          self.postText = ""
          self.postChannel = ""
          self.postMessageVisible = false
          self.showPreview = false
          if (self.$refs.markdownEditor)
            self.$refs.markdownEditor.setMarkdown(self.descriptionText)

          self.refresh()
        })
      },

      refresh: function() {
        // Don't allow concurrent refreshing.
        if (this.isRefreshing)
          return

        console.log("Refreshing")
        this.messages = []
        this.offset = 0
        this.renderPublic()
      }
    },

    created: function () {
      var self = this
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('public.title')

      window.updateFirstTimeLoading = function() {
        self.showOnboarding = window.firstTimeLoading
      }

      // Pull preferences for filters.
      const filterNamesSeparatedByPipes = localPrefs.getPublicFilters();
      this.onlyDirectFollow = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlydirectfollow') >= 0)
      this.onlyThreads = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlythreads') >= 0)
      this.onlyChannels = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlychannels') >= 0)
      this.onlyChannelsList = localPrefs.getFavoriteChannels()
      this.hideChannels = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('hidechannels') >= 0)
      this.hideChannelsList = localPrefs.getHiddenChannels()
      this.onlyGroups = (filterNamesSeparatedByPipes && filterNamesSeparatedByPipes.indexOf('onlygroups') >= 0)
      userGroups.getGroups((err, groups) => {
        // Need to transform this by which groups still exist as well as generate their current names.
        var rawOnlyGroupsList = localPrefs.getFavoriteGroups()
        var transformedGroupsList = []
        for (r in rawOnlyGroupsList) {
          for (g in groups) {
            if (groups[g].id == rawOnlyGroupsList[r])
              transformedGroupsList.push({ label: groups[g].name, id: groups[g].id })
          }
        }
        self.onlyGroupsList = transformedGroupsList
      })

      this.renderPublic()

      // delay a bit as other things are more important
      setTimeout(() => {
        // Start this loading to make it easier for the user to filter by channels.
        this.loadChannels()
        this.loadGroups()
      }, 3000)
    },

    destroyed: function () {
      this.componentStillLoaded = false
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

      hideChannels: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      },

      onlyGroups: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      },

      onlyChannelsList: function (newValue, oldValue) {
        this.saveFilters()

        // Only refresh if it changed while the checkbox is checked.
        if (this.onlyChannels)
          this.refresh()
      },

      hideChannelsList: function (newValue, oldValue) {
        this.saveFilters()

        // Only refresh if it changed while the checkbox is checked.
        if (this.hideChannels)
          this.refresh()
      },

      onlyGroupsList: function (newValue, oldValue) {
        this.saveFilters()

        // Only refresh if it changed while the checkbox is checked.
        if (this.onlyGroups)
          this.refresh()
      },

      onlyThreads: function (newValue, oldValue) {
        this.saveFilters()
        this.refresh()
      }
    }
  }
}
