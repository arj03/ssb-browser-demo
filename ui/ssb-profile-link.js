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

    var self = this
    SSB.getProfileAsync(this.feedId, (err, profile) => {
      if (profile) {
        if (this.feedId != SSB.net.id)
          this.name = profile.name
        if (profile.image) {
          if (typeof profile.image === 'object' && profile.image.link)
            profile.image = profile.image.link
          SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
            if (err)
              return console.error("failed to get img", err)
  
            self.imgURL = url
          })
        }
      }
    })
  }
})
