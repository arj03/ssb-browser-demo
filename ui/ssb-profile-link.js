const helpers = require('./helpers')

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
      const self = this
      if (self.feedId != SSB.net.id)
        self.name = profile.name

      if (profile.imageURL) self.imgURL = profile.imageURL
      else if (profile.image) {
        SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
          if (err) return console.error("failed to get img", err)

          profile.imageURL = self.imgURL = url
        })
      }
    }
  },

  created: function () {
    const self = this

    if (self.feedId == SSB.net.id)
      self.name = "You"

    // Set a default image to be overridden if there is an actual avatar to show.
    self.imgURL = helpers.getMissingProfileImage()

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
  }
})
