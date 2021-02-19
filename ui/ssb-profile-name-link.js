Vue.component('ssb-profile-name-link', {
  template: `
        <router-link :to="{name: 'profile', params: { feedId: feedId }}">
          <span v-if="isBlocked" class="blockedSymbol">🚫</span>
          <span v-bind:class="{ blockedName: isBlocked }">{{ name }}</span>
        </router-link>`,

  props: ['feedId'],

  data: function() {
    return {
      isBlocked: false,
      name: ''
    }
  },

  methods: {
    renderProfile: function(profile) {
      const self = this
      if (self.feedId != SSB.net.id)
        self.name = profile.name
    }
  },

  created: function () {
    const self = this

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
  },

  watch: {
    feedId: function (oldValue, newValue) {
      this.created()
    }
  }
})
