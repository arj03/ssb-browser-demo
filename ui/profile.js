const pull = require('pull-stream')
const paramap = require('pull-paramap')

const SSBContactMsg = require('ssb-contact-msg/async/create')

module.exports = function () {
  return {
    template: `
       <template v-if="following">You are following - </template>
       <button v-on:click="changeFollowStatus">{{ followText }}</button>
       <h2>Last 50 messages for {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
       <div id="messages"></div>`,

    props: ['feedId'],
    
    data: function() {
      return {
        following: false,
        name: ''
      }
    },

    computed: {
      followText: function() { return following ? "Unfollow" : "Follow" }
    },
    
    methods: {
      changeFollowStatus: function() {
        var contact = SSBContactMsg(SSB)
        if (following) {
          contact.unfollow(feedId, () => {
            alert("unfollowed!") // FIXME: proper UI
          })
        } else {
          contact.follow(feedId, () => {
            SSB.syncFeedAfterFollow(feedId)
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
                  author: feedId,
                  content: {
                    type: 'post'
                  }
                }
              }
            }]
          }),
          pull.collect((err, msgs) => {
            var name = feedId
            if (SSB.profiles && SSB.profiles[feedId])
              name = SSB.profiles[feedId].name

            if (feedId != SSB.net.id) {
              SSB.db.friends.isFollowing({source: SSB.net.id, dest: feedId }, (err, status) => {
                following = status
              })
            }

            pull(
              pull.values(msgs),
              paramap(renderMessage, 1),
              pull.collect((err, rendered) => {
                document.getElementById("messages").innerHTML = rendered.join('')
                window.scrollTo(0, 0)
              })
            )
          })
        )
      }
    }
  }
}
