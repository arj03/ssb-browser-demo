module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const localPrefs = require('../localprefs')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  return {
    template: `
    <div id="channels">
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
          <router-link :to="{name: 'channel', params: { channel: channel }}">#{{ channel }}<sup v-if="count > 0">[&nbsp;{{ count }}&nbsp;]</sup></router-link>
        </li>
      </ol>
      <p v-if="channels.length == 0">{{ $t('channels.loading') }}</p>
    </div>`,

    data: function() {
      return {
        channels: [],
        favoriteChannels: [],
        componentStillLoaded: false,
        sortMode: "recent"
      }
    },

    methods: {
      load: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.renderChannelsCB)
      },

      renderChannelsCB: function(err, SSB) {
        const { where, and, not, isPublic, type, channel, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        document.body.classList.add('refreshing')

        // Get favorite channels from preferences.
        this.favoriteChannels = localPrefs.getFavoriteChannels().map(x => x.replace(/^#+/, '')).sort(Intl.Collator().compare)

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
            where(
              and(
                not(channel('')),
                type('post'),
                isPublic()
              )
            ),
            descending(),
            startFrom(0),
            paginate(500),
            resultCallback
          )
        } else {
          // Just pull channels.
          const channelIndex = SSB.db.getIndex("channels")
          const allChannels = channelIndex.getChannels()
          const sortFunc = (new Intl.Collator()).compare
          var transformedChannels = {}
          if (this.sortMode == "popular") {
            for (c in allChannels)
              transformedChannels[allChannels[c]] = (channelIndex.getChannelUsage(allChannels[c]) || 0)
            var newChannels = {}
            const sortByPopularity = (a, b) => {
              if(transformedChannels[a] < transformedChannels[b])
                return 1
              if(transformedChannels[a] > transformedChannels[b])
                return -1
              return 0
            }
            Object.keys(transformedChannels).sort(sortByPopularity).forEach((item, index, array) => {
              newChannels[item] = transformedChannels[item]
            });
            this.channels = newChannels
          } else {
            const filteredChannels = allChannels.sort(sortFunc)
            for (c in filteredChannels)
              transformedChannels[filteredChannels[c]] = 0
            this.channels = transformedChannels
          }
          document.body.classList.remove('refreshing')
          console.timeEnd("channel list")
        }
      },
    },

    created: function () {
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('channels.title')

      this.load()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    }
  }
}
