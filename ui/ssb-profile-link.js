Vue.component('ssb-profile-link', {
  template: `
        <router-link :to="{name: 'profile', params: { feedId: feedId }}">
          <img class='avatar' :src='imgURL' :title="name" />
        </router-link>`,

  props: ['feedId'],

  data: function() {
    return {
      imgURL: '',
      name: ''
    }
  },

  created: function () {
    if (this.feedId == SSB.net.id)
      this.name = "You"
    
    // Set a default image to be overridden if there is an actual avatar to show.
    this.imgURL = 'assets/noavatar.svg';

    const profile = SSB.db.getIndex('profiles').getProfile(this.feedId)
    if (profile) {
      if (this.feedId != SSB.net.id)
        this.name = profile.name
      if (profile.image) {
        var self = this
        SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
          if (err)
            return console.error("failed to get img", err)

          self.imgURL = url
        })
      }
    }
  }
})
