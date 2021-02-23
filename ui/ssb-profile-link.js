const helpers = require('./helpers')
const ssbSingleton = require('../ssb-singleton')

Vue.component('ssb-profile-link', {
  template: `
        <router-link :to="{name: 'profile', params: { feedId: feedId }}" v-bind:class="{ blockedAvatar: isBlocked }">
          <img class='avatar' :src='imgURL' :title="name" />
          <span v-if="isBlocked" class="blockedSymbol">🚫</span>
        </router-link>`,

  props: ['feedId'],

  data: function() {
    return {
      imgURL: '',
      isBlocked: false,
      name: ''
    }
  },

  methods: {
    renderProfile: function(profile) {
      [ err, SSB ] = ssbSingleton.getSSB()
      const self = this
      if (SSB && SSB.net) {
        if (self.feedId != SSB.net.id)
          self.name = profile.name

        if (profile.imageURL) self.imgURL = profile.imageURL
        else if (profile.image) {
          SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
            if (err) return console.error("failed to get img", err)
  
            profile.imageURL = self.imgURL = url
          })
        }
      } else {
        // Try again later.
        setTimeout(function() { self.renderProfile(profile) }, 3000)
      }
    },

    tryLoading: function () {
      const self = this

      // Set a default image to be overridden if there is an actual avatar to show.
      self.imgURL = helpers.getMissingProfileImage();

      [ err, SSB ] = ssbSingleton.getSSB()
      if (SSB && SSB.net) {
        if (self.feedId == SSB.net.id)
          self.name = this.$root.$t('common.selfPronoun')
  
        SSB.net.friends.isBlocking({ source: SSB.net.id, dest: self.feedId }, (err, result) => {
          if (!err) self.isBlocked = result
        })
  
        const profile = SSB.getProfile(self.feedId)
        if (profile.name || profile.imageURL || profile.image) {
          self.renderProfile(profile)
        } else {
          // Try one more time after the profile index has loaded.
          setTimeout(() => {
            const profileAgain = SSB.getProfile(self.feedId)
            if (profileAgain)
              self.renderProfile(profileAgain)
          }, 3000)
        }
      } else {
        // No SSB - try again later.
        setTimeout(self.tryLoading, 3000)
      }
    }
  },

  created: function() {
    this.tryLoading()
  }
})
