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
    SSB.db.getProfiles((err, profiles) => {
      if (this.feedId == SSB.net.id)
        this.name = "You"
      else if (profiles) {
        var profile = profiles[this.feedId]
        if (profile) {
          this.name = profile.name
          if (profile.image) {
            var self = this
            SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
              if (!err)
                self.imgURL = url
              else
                console.error("failed to get img", err)
            })
          }
        }
      }
    })
  }
})
  
  
