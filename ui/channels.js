module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const localPrefs = require('../localprefs')
  const userGroups = require('../usergroups')
  const { and, not, isPublic, type, channel, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  return {
    template: `
    <div id="channels">
      <h2>{{ $t('channels.yourGroups') }}</h2>
      <div>
        <div v-for="group in groups">
          <h4><router-link :to="{name: 'group', params: { group: group.id }}">{{ group.name }}</router-link> <a href="javascript:void(0)" v-on:click="deleteGroup(group)" title="Delete group" style="color: #900;">X</a></h4>
          <ul class="groupMembers">
            <li v-for="member in group.members">
              <ssb-profile-link v-bind:key="member" v-bind:feedId="member"></ssb-profile-link>
            </li>
          </ul>
          <div class="clearingDiv"></div>
        </div>
        <input type="text" v-model="groupName" :placeholder="$t('channels.newGroupName')" />&nbsp;<button class="clickButton" v-on:click="addGroup">{{ $t('channels.addGroup') }}</button>
      </div>
      <h2>{{ $t('channels.title') }}</h2>
      <div v-if="favoriteChannels.length > 0">
        <h3>{{ $t('channels.favoriteChannels') }}</h3>
        <ol>
          <li v-for="channel in favoriteChannels">
            <router-link :to="{name: 'channel', params: { channel: channel }}">#{{ channel }}</router-link>
          </li>
        </ol>
        <h3>{{ $t('channels.otherChannels') }}</h3>
      </div>
      <label for="sortMode">{{ $t('channels.showChannels') }}</label> <select id="shortMode" v-model="sortMode" v-on:change="load()">
      <option value="recent">{{ $t('channels.showChannelsRecent') }}</option>
      <option value="popular">{{ $t('channels.showChannelsPopular') }}</option>
      <option value="all">{{ $t('channels.showChannelsAll') }}</option>
      </select>
      <ol>
        <li v-for="(count, channel) in channels">
          <router-link :to="{name: 'channel', params: { channel: channel }}">#{{ channel }}<sup>[&nbsp;{{ count }}&nbsp;]</sup></router-link>
        </li>
      </ol>
      <p v-if="channels.length == 0">{{ $t('channels.loading') }}</p>
    </div>`,

    data: function() {
      return {
        channels: [],
        favoriteChannels: [],
        groups: [],
        groupName: '',
        sortMode: "recent"
      }
    },

    methods: {
      groupMemberInfoCallback: function(err, groupId, members) {
        for (g in this.groups) {
          if (this.groups[g].id == groupId) {
            this.groups[g].members = members
            return
          }
        }
      },

      loadGroups: function() {
        var self = this
        userGroups.getGroups((err, groups) => {
          for (g in groups) {
            var found = false
            var fetchMembers = true
            for (l in self.groups) {
              if (groups[g].id == self.groups[l].id) {
                found = true
                if (self.groups[l].members && self.groups[l].members.length > 0) {
                  // Already have member info.
                  groups[g].members = self.groups[l].members
                  fetchMembers = false
                }
              }
            }

            if (!found) {
              groups[g].members = []
              self.groups.push(groups[g])
            }
            if (fetchMembers) {
              userGroups.getMembers(groups[g].id, self.groupMemberInfoCallback)
            }
          }

          // Normally I'd like to do this with a temporary variable and storing to the data variable once at the end, but in this case we've got too many potential member callbacks - complexity would be too high.
          const sortFunc = (new Intl.Collator()).compare
          self.groups = self.groups.sort((a, b) => { return sortFunc(a.name, b.name) })
        })
      },

      addGroup: function() {
        var self = this
        userGroups.addGroup({ name: this.groupName }, (err, groupId) => {
          if (err) {
            alert(err)
          } else {
            self.loadGroups()
            self.groupName = ''
          }
        })
      },

      deleteGroup: function(group) {
        var self = this
        if (confirm(this.$root.$t('channels.confirmDeleteGroup', { group: group.name }))) {
          userGroups.deleteGroup(group.id, (err, success) => {
            if (err)
              alert(err)
            else {
              self.groups = []
              self.loadGroups()
            }
          })
        }
      },

      load: function() {
        document.body.classList.add('refreshing')

        // Get favorite channels from preferences.
        this.favoriteChannels = localPrefs.getFavoriteChannels().map(x => x.replace(/^#+/, '')).sort(Intl.Collator().compare)

        this.loadGroups()

        console.time("channel list")
        
        const resultCallback = toCallback((err, answer) => {
          if (!err) {
            var newChannels = {}

            var posts = (answer.results ? answer.results : answer);

            for (r in posts) {
              var channel = posts[r].value.content.channel

              if(channel && channel.charAt(0) == '#')
                channel = channel.substring(1, channel.length)

              if (channel && channel != '' && channel != '"') {
                if(!newChannels[channel])
                  newChannels[channel] = 0

                ++newChannels[channel]
              }
            }

            // Sort.
            this.channels = {};
            var sortFunc = Intl.Collator().compare
            if(this.sortMode == "recent" || this.sortMode == "popular")
              sortFunc = (a, b) => {
                // Compare based on number of posts.
                if(newChannels[a] < newChannels[b])
                  return 1

                if(newChannels[a] > newChannels[b])
                  return -1

                return 0
              }

            Object.keys(newChannels).sort(sortFunc).forEach((item, index, array) => {
              this.channels[item] = newChannels[item]
            });
          }

          document.body.classList.remove('refreshing')
          console.timeEnd("channel list")
        })

        if(this.sortMode == "recent") {
          // Only look at the most recent posts.
          SSB.db.query(
            and(not(channel('')), type('post'), isPublic()),
            descending(),
            startFrom(0),
            paginate(500),
            resultCallback
          )
        } else {
          // Look at all posts.
          SSB.db.query(
            and(not(channel('')), type('post'), isPublic()),
            resultCallback
          )
        }
      },
    },

    created: function () {
      document.title = this.$root.appTitle + " - " + this.$root.$t('channels.title')

      this.load()
    }
  }
}
