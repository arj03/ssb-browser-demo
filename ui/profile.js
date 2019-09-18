const pull = require('pull-stream')
const md = require('./markdown')

const SSBContactMsg = require('ssb-contact-msg/async/create')

module.exports = function () {
  return {
    template: `
       <div id="profile">
         <span v-if="isSelf">
         </span>
         <span v-else>
           <div class="avatar">
             <img :src='image'><br>
             <button v-on:click="changeFollowStatus">{{ followText }}</button>
             <br><br>
           </div>
           <div class="description">
             <span v-html="description"></span>
           </div>
         </span>
         <h2>Last 25 messages for {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
       </div>`,

    props: ['feedId'],
    
    data: function() {
      return {
        following: false,
        name: '',
        image: '',
        descriptionText: '',
        messages: []
      }
    },

    computed: {
      followText: function() { return this.following ? "Unfollow" : "Follow" },
      isSelf: function() { return SSB.net.id == this.feedId },
      description: function() { return md.markdown(this.descriptionText) }
    },
    
    methods: {
      changeFollowStatus: function() {
        var contact = SSBContactMsg(SSB)
        if (this.following) {
          contact.unfollow(this.feedId, () => {
            alert("unfollowed!") // FIXME: proper UI
          })
        } else {
          var self = this
          contact.follow(this.feedId, () => {
            SSB.syncFeedAfterFollow(self.feedId)
            alert("followed!") // FIXME: proper UI
          })
        }
      },
      
      renderProfile: function () {
        pull(
          SSB.db.query.read({
            reverse: true,
            limit: 25,
            query: [{
              $filter: {
                value: {
                  timestamp: { $gt: 0 },
                  author: this.feedId,
                  content: {
                    type: 'post'
                  }
                }
              }
            }]
          }),
          pull.collect((err, msgs) => {
            if (SSB.profiles && SSB.profiles[this.feedId]) {
              this.name = SSB.profiles[this.feedId].name
              this.descriptionText = SSB.profiles[this.feedId].description
              if (SSB.profiles[this.feedId].image) {
                SSB.net.blobs.localGet(SSB.profiles[this.feedId].image, (err, url) => {
                  if (!err)
                    this.image = url
                })
              }
            }

            if (this.feedId != SSB.net.id) {
              SSB.db.friends.isFollowing({source: SSB.net.id, dest: this.feedId }, (err, status) => {
                this.following = status
              })
            }

            this.messages = msgs
          })
        )
      }
    },

    created: function () {
      this.renderProfile()
    },
  }
}
