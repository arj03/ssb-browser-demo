const helpers = require('./helpers')
const ssbSingleton = require('ssb-browser-core/ssb-singleton')

Vue.component('ssb-profile-link', {
  template: `
        <router-link :to="{name: 'profile', params: { feedId: feedId }}" v-bind:class="{ blockedAvatar: isBlocked }">
          <img class='avatar' :src='imgURL' :title="name" />
          <span v-if="isBlocked" class="blockedSymbol">🚫</span>
        </router-link>`,

  props: ['feedId'],

  data: function() {
    return {
      componentStillLoaded: false,
      imgURL: '',
      isBlocked: false,
      name: ''
    }
  },

  methods: {
    renderProfile: function(profile) {
      var self = this
      ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
        (SSB) => { return SSB && SSB.net }, (err, SSB) => { self.renderProfileCallback(err, SSB, profile) } )
    },

    renderProfileCallback: function (err, SSB, existingProfile) {
      const self = this
      const profile = existingProfile || SSB.getProfile(self.feedId)

      // Set a default image to be overridden if there is an actual avatar to show.
      self.imgURL = helpers.getMissingProfileImage();

      if (self.feedId == SSB.net.id)
        self.name = this.$root.$t('common.selfPronoun')
      else
        self.name = profile.name
  
      if (profile.imageURL) self.imgURL = profile.imageURL
      else if (profile.image) {
        SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
          if (err) return console.error("failed to get img", err)
  
          profile.imageURL = self.imgURL = url
        })
      }
    },

    loadBlocking: function (err, SSB) {
      SSB.net.friends.isBlocking({ source: SSB.net.id, dest: self.feedId }, (err, result) => {
        if (!err) self.isBlocked = result
      })
    },

    refresh: function() {
      var self = this
      // Set a default image while we wait for an SSB.
      self.imgURL = helpers.getMissingProfileImage();
      ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
        (SSB) => { return SSB && SSB.net }, self.loadBlocking)
      ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
        (SSB) => { return SSB && SSB.net && SSB.getProfile && (profile = SSB.getProfile(self.feedId)) && Object.keys(profile).length > 0 }, self.renderProfileCallback)
    }
  },

  created: function() {
    this.componentStillLoaded = true
    this.refresh()
  },

  destroyed: function() {
    this.componentStillLoaded = false
  },

  watch: {
    feedId: function (oldValue, newValue) {
      this.refresh()
    }
  }
})
