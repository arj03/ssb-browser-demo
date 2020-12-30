module.exports = function () {
  const pull = require('pull-stream')
  const md = require('./markdown')
  const { and, author, type, startFrom, paginate, toCallback } = require('ssb-db2/operators')  
  
  let initialState = function() {
    return {
      following: false,
      blocking: false,
      name: '',
      image: '',
      imageBlobId: '',
      descriptionText: '',
      messages: [],
      canDownloadMessages: true,
      canDownloadProfile: true,
      friends: [],
      blocked: [],

      showExportKey: false,
      showImportKey: false,
      mnemonic: '',

      offset: 0
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
             <button class="clickButton" v-on:click="changeBlockStatus">{{ blockText }}</button>
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
         <h2 v-if="blocked">Blocking</h2>
         <div id="blocked">
           <div v-for="block in blocked">
             <ssb-profile-link v-bind:key="block" v-bind:feedId="block"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2>Last 25 messages for {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
         <button v-if="canDownloadProfile" class="clickButton" v-on:click="downloadFollowing">Download following</button>
         <button v-if="canDownloadProfile" class="clickButton" v-on:click="downloadProfile">Download profile</button>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
         <button class="clickButton" v-on:click="loadMore">Load more</button>
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
      blockText: function() { return this.blocking ? "Unblock" : "Block" },
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
        SSB.net.config.keys = key
        Object.assign(this.$data, initialState())

        SSB.syncFeedFromSequence(this.feedId, 0, this.renderProfile)
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
        })
      },

      changeFollowStatus: function() {
        if (this.following) {
          SSB.publish({
            type: 'contact',
            contact: this.feedId,
            following: false
          }, () => {
            alert("unfollowed!") // FIXME: proper UI
          })
        } else {
          var self = this
          SSB.publish({
            type: 'contact',
            contact: this.feedId,
            following: true
          }, () => {
            alert("followed!") // FIXME: proper UI
            // wait for db sync
            SSB.db.getIndex('contacts').getGraphForFeed(SSB.net.id, () => SSB.net.sync(SSB.getPeer()))
          })
        }
      },

      changeBlockStatus: function() {
        if (this.blocking) {
          SSB.publish({
            type: 'contact',
            contact: this.feedId,
            blocking: false
          }, () => {
            alert("unblocked!") // FIXME: proper UI
          })
        } else {
          SSB.publish({
            type: 'contact',
            contact: this.feedId,
            blocking: true
          }, () => {
            alert("blocked!") // FIXME: proper UI
          })
        }
      },

      deleteFeed: function() {
        SSB.db.deleteFeed(this.feedId, (err) => {
          if (err) return alert("Failed to remove feed", err)

          this.$router.push({ path: '/public'})
        })
      },

      downloadMessages: function() {
        if (this.feedId == SSB.net.id)
          SSB.syncFeedFromSequence(this.feedId, 0, this.renderProfile)
        else {
          SSB.syncFeedFromLatest(this.feedId, () => {
            // FIXME: not working
            SSB.db.partial.updateState(this.feedId, { syncedMessages: true }, () => {
              this.renderProfile()
            })
          })
        }
      },
      
      downloadProfile: function() {
        let rpc = SSB.getPeer()
        if (!rpc) {
          console.log("No remote connection, unable to download profile")
          return
        }

        console.time("syncing profile")

        pull(
          rpc.partialReplication.getMessagesOfType({id: this.feedId, type: 'about'}),
          pull.asyncMap(SSB.db.addOOO),
          pull.collect((err, msgs) => {
            if (err) alert(err.message)

            console.timeEnd("syncing profile")
            console.log(msgs.length)

            // FIXME: not working
            SSB.db.partial.updateState(this.feedId, { syncedProfile: true }, () => {
              this.renderProfile()
            })
          })
        )
      },

      downloadFollowing: function() {
        let rpc = SSB.getPeer()

        if (!rpc) {
          console.log("No remote connection, unable to download profile")
          return
        }

        console.time("download following")

        pull(
          rpc.partialReplication.getMessagesOfType({id: this.feedId, type: 'contact'}),
          pull.asyncMap(SSB.db.addOOO),
          pull.collect((err, msgs) => {
            if (err) alert(err.message)

            console.timeEnd("download following")
            console.log(msgs.length)

            // FIXME: not working
            SSB.db.partial.updateState(this.feedId, { syncedContacts: true }, () => {
              this.renderProfile()
            })
          })
        )
      },

      loadMore: function() {
        SSB.db.query(
          and(author(this.feedId), type('post')),
          startFrom(this.offset),
          paginate(25),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results.filter(msg => !msg.value.meta))
            this.offset += answer.results.length
          })
        )
      },

      renderProfile: function () {
        var self = this
        const contacts = SSB.db.getIndex('contacts')
        contacts.getGraphForFeed(self.feedId, (err, graph) => {
          self.friends = graph.following
          self.blocked = graph.blocking

          self.following = self.feedId != SSB.net.id && contacts.isFollowing(SSB.net.id, self.feedId)
          self.blocking = self.feedId != SSB.net.id && contacts.isBlocking(SSB.net.id, self.feedId)
        })

        document.body.classList.add('refreshing')

        console.time("latest 25 profile messages")
        SSB.db.query(
          and(author(this.feedId), type('post')),
          startFrom(this.offset),
          paginate(25),
          toCallback((err, answer) => {
            const results = answer.results
            this.messages = results.filter(msg => !msg.value.meta)
            this.offset += results.length

            if (results.length < 5)
              this.canDownloadMessages = true
            else
              this.canDownloadMessages = false

            console.timeEnd("latest 25 profile messages")

            document.body.classList.remove('refreshing')
          })
        )

        const profiles = SSB.db.getIndex('profiles').getProfiles()
        const profile = profiles[this.feedId]

        if (!profile) return

        if (profile.name)
          this.name = profile.name

        if (profile.description)
          this.descriptionText = profile.description

        if (profile.image) {
          SSB.net.blobs.localGet(profile.image, (err, url) => {
            if (!err) {
              self.image = url
              self.imageBlobId = profile.image
            }
          })
        }
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
