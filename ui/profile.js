const pull = require('pull-stream')
const md = require('./markdown')

const SSBContactMsg = require('ssb-contact-msg/async/create')

module.exports = function () {
  let initialState = function() {
    return {
      following: false,
      name: '',
      image: '',
      imageBlobId: '',
      descriptionText: '',
      messages: [],
      canDownloadMessages: true,
      canDownloadProfile: true,
      friends: [],

      showExportKey: false,
      showImportKey: false,
      mnemonic: ''
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
             <button class="clickButton" v-on:click="exportKey">Export feed key to mnemonic code</button>
             <button class="clickButton" v-on:click="showImportKey = true">Load feed key from mnemonic code</button>
             <button class="clickButton" v-on:click="saveProfile">Save profile</button>
           </div>
         </span>
         <span v-else>
           <div class="avatar">
             <img :src='image'><br>
             <button class="clickButton" v-on:click="changeFollowStatus">{{ followText }}</button>
             <button class="clickButton" v-on:click="deleteFeed">Remove feed &#x2622</button>
             <br><br>
           </div>
           <div class="description">
             <span v-html="description"></span>
           </div>
         </span>
         <h2 v-if="friends">Following</h2>
         <div id="follows">
           <div v-for="friend in friends">
             <ssb-profile-link v-bind:key="friend" v-bind:feedId="friend"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2>Last 25 messages for {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
         <button v-if="canDownloadProfile" class="clickButton" v-on:click="downloadProfile">Download profile</button>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <button v-if="canDownloadMessages" class="clickButton" v-on:click="downloadMessages">Download latest messages for user</button>

         <transition name="modal" v-if="showExportKey">
           <div class="modal-mask">
             <div class="modal-wrapper">
               <div class="modal-container">
                 <div>
                   <b>A mnemonic code has been generated from your private feed key.</b>
                   <div style="padding-top: 10px;">
                     This code can be used to restore your identitfy later. Store this somewhere safe.
                   </div>
                 </div>

                 <div class="modal-body">
                   {{ mnemonic }}
                 </div>

                 <div class="modal-footer">
                   <button class="modal-default-button clickButton" @click="showExportKey = false">
                     Close
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </transition>

         <transition name="modal" v-if="showImportKey">
           <div class="modal-mask">
             <div class="modal-wrapper">
               <div class="modal-container">
                 <div>
                   <b>Enter mnemonic code below to restore your feed key.</b>
                   <div style="padding-top: 10px;">
                     WARNING: this will overwrite your current feed key!
                   </div>
                 </div>

                 <div class="modal-body">
                    <textarea placeholder="Mnemonic code" v-model="mnemonic"></textarea><br>
                 </div>

                 <div class="modal-footer">
                    <button class="modal-default-button clickButton" style="margin-left: 20px;" v-on:click="restoreKey">
                      Restore feed
                   </button>
                   <button class="modal-default-button clickButton" @click="showImportKey = false">
                     Close
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </transition>
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

      exportKey: function() {
        const mnemonic = require('ssb-keys-mnemonic')
        this.mnemonic = mnemonic.keysToWords(JSON.parse(localStorage["/.ssb-lite/secret"]))
        this.showExportKey = true
      },

      restoreKey: function() {
        const mnemonic = require('ssb-keys-mnemonic')
        const key = mnemonic.wordsToKeys(this.mnemonic)
        localStorage["/.ssb-lite/secret"] = JSON.stringify(key)
        this.showImportKey = false

        SSB.net.id = this.feedId = key.id
        Object.assign(this.$data, initialState())
        this.renderProfile()
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

      deleteFeed: function() {
        SSB.db.deleteFeed(this.feedId, (err) => {
          if (err) return alert("Failed to remove feed", err)

          SSB.removeFeedState(this.feedId)

          this.$router.push({ path: '/public'})
        })
      },

      downloadMessages: function() {
        if (this.feedId == SSB.net.id)
          SSB.syncFeedFromSequence(this.feedId, 0, this.renderProfile)
        else
          SSB.syncFeedFromLatest(this.feedId, this.renderProfile)
      },
      
      downloadProfile: function() {
        console.time("syncing profile")
        var profile = {}
        SSB.syncLatestProfile(this.feedId, profile, this.messages[this.messages.length-1].value.sequence, (err, msg) => {
          console.timeEnd("syncing profile")
          SSB.profiles[this.feedId] = profile
          SSB.saveProfiles()
          this.renderProfile()
        })
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

            if (msgs.length == 0)
              this.canDownloadProfile = false
            else
              this.canDownloadProfile = true

            if (msgs.length < 5)
              this.canDownloadMessages = true
            else
              this.canDownloadMessages = false

            if (SSB.profiles && SSB.profiles[this.feedId]) {
              var profile = SSB.profiles[this.feedId]

              if (profile.name) {
                this.name = profile.name
                this.canDownloadProfile = false
              }

              if (profile.description)
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
      if (this.feedId === SSB.net.id) {
        pull(
          SSB.db.friends.createFriendStream(),
          pull.collect((err, a) => {
            this.friends = a.filter(x => x != this.feedId)
          })
        )
      }

      this.renderProfile()
    },
  }
}
