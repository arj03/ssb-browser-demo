const pull = require('pull-stream')

const SSBContactMsg = require('ssb-contact-msg/async/create')

module.exports = function () {
  return {
    template: `
       <div id="profile">
         <template v-if="following">You are following - </template>
         <button v-on:click="changeFollowStatus">{{ followText }}</button>
         <h2>Last 50 messages for {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
       </div>`,

    props: ['feedId'],
    
    data: function() {
      return {
        following: false,
        name: '',
        messages: []
      }
    },

    computed: {
      followText: function() { return this.following ? "Unfollow" : "Follow" }
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
            limit: 50,
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
            var self = this

            var name = this.feedId
            if (SSB.profiles && SSB.profiles[this.feedId])
              name = SSB.profiles[this.feedId].name

            if (this.feedId != SSB.net.id) {
              SSB.db.friends.isFollowing({source: SSB.net.id, dest: this.feedId }, (err, status) => {
                self.following = status
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
