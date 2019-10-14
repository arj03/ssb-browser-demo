const pull = require('pull-stream')
const md = require('./markdown')

const SSBContactMsg = require('ssb-contact-msg/async/create')

module.exports = function () {
  initialState = function() {
    return {
      following: false,
      name: '',
      image: '',
      imageBlobId: '',
      descriptionText: '',
      messages: []
    }
  }

  return {
    template: `
       <div id="profile">
         <span v-if="isSelf">
           <div class="avatar">
             <img :src='image'><br>
             <input type="file" v-on:change="onFileSelect"><br>
             <input id="name" type="text" v-model="name" placeholder="Your name / nick">
             <br>
           </div>
           <div class="description">
             <textarea placeholder="Description (markdown is supported)" v-model="descriptionText"></textarea><br>
             <button class="clickButton" v-on:click="saveProfile">Save profile</button>
           </div>
         </span>
         <span v-else>
           <div class="avatar">
             <img :src='image'><br>
             <button class="clickButton" v-on:click="changeFollowStatus">{{ followText }}</button>
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
      return initialState()
    },

    computed: {
      followText: function() { return this.following ? "Unfollow" : "Follow" },
      isSelf: function() { return SSB.net.id == this.feedId },
      description: function() { return md.markdown(this.descriptionText) }
    },
    
    methods: {
      onFileSelect: function(ev) {
        const file = ev.target.files[0]

        if (!file) return

        var self = this

        file.arrayBuffer().then(function (buffer) {
          SSB.net.blobs.hash(new Uint8Array(buffer), (err, digest) => {
            var blobId = "&" + digest
            SSB.net.blobs.add(blobId, file, (err) => {
              if (!err) {
                SSB.net.blobs.push(blobId, (err) => {
                  SSB.net.blobs.localGet(blobId, (err, url) => {
                    if (!err) {
                      self.image = url
                      self.imageBlobId = blobId
                    }
                  })
                })
              } else
                alert("failed to add img", err)
            })
          })
        })
      },

      saveProfile: function() {
        var msg = { type: 'about', about: SSB.net.id }
        if (this.name)
          msg.name = this.name
        if (this.descriptionText)
          msg.description = this.descriptionText
        if (this.imageBlobId != '') {
          msg.image = {
            link: this.imageBlobId
          }
        }

        SSB.publish(msg, (err) => {
          if (err) return alert(err)

          alert("Saved!")

          SSB.profiles[this.feedId] = {
            name: this.name,
            description: this.descriptionText,
            image: this.imageBlobId
          }

          SSB.saveProfiles()
        })
      },

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
              var profile = SSB.profiles[this.feedId]
              this.name = profile.name
              this.descriptionText = profile.description
              if (profile.image) {
                var self = this
                SSB.net.blobs.localGet(profile.image, (err, url) => {
                  if (!err) {
                    self.image = url
                    self.imageBlobId = profile.image
                  }
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

    beforeRouteUpdate(to, from, next) {
      this.feedId = to.params.feedId
      Object.assign(this.$data, initialState())
      this.renderProfile()
      next()
    },

    created: function () {
      this.renderProfile()
    },
  }
}
