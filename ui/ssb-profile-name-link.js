const ssbSingleton = require('ssb-browser-core/ssb-singleton')

Vue.component('ssb-profile-name-link', {
  template: `
        <router-link :to="{name: 'profile', params: { feedId: feedId }}">
          <span v-if="isBlocked" class="blockedSymbol">🚫</span>
          <span v-bind:class="{ blockedName: isBlocked }">{{ name }}</span>
        </router-link>`,

  props: ['feedId'],

  data: function() {
    return {
      componentStillLoaded: false,
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
  
      if (self.feedId == SSB.net.id)
        self.name = this.$root.$t('common.selfPronoun')
      else
        self.name = profile.name
    },

    loadBlocking: function (err, SSB) {
      SSB.net.friends.isBlocking({ source: SSB.net.id, dest: self.feedId }, (err, result) => {
        if (!err) self.isBlocked = result
      })
    },

    refresh: function () {
      var self = this
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
