module.exports = function () {
  const pull = require('pull-stream')
  const md = require('./markdown')
  const { and, author, type, isPublic, startFrom, paginate, descending, toCallback } = SSB.dbOperators
  
  let initialState = function() {
    return {
      following: false,
      blocking: false,
      name: '',
      image: 'assets/noavatar.svg',
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
             <input id="name" type="text" v-model="name" :placeholder="$t('profile.profileNamePlaceholder')">
             <br>
           </div>
           <div class="description">
             <textarea :placeholder="$t('profile.profileDescriptionPlaceholder')" v-model="descriptionText"></textarea><br>
             <button class="clickButton" v-on:click="exportKey">{{ $t('profile.exportKey') }}</button>
             <button class="clickButton" v-on:click="showImportKey = true">{{ $t('profile.loadKey') }}</button>
             <button class="clickButton" v-on:click="saveProfile">{{ $t('profile.saveProfile') }}</button>
           </div>
         </span>
         <span v-else>
           <div class="avatar">
             <img :src='image'><br>
             <router-link class="clickButton" tag="button" :to="{name: 'private-feed', params: { feedId: feedId }}">{{ $t('profile.sendMessage') }}</router-link>
             <button class="clickButton" v-on:click="changeFollowStatus">{{ followText }}</button>
             <button class="clickButton" v-on:click="changeBlockStatus">{{ blockText }}</button>
             <button class="clickButton" v-on:click="deleteFeed">{{ $t('profile.removeFeed') }} &#x2622</button>
             <br><br>
           </div>
           <div class="description">
             <span v-html="description"></span>
           </div>
         </span>
         <h2 v-if="friends">{{ $t('profile.following') }}</h2>
         <div id="follows">
           <div v-for="friend in friends">
             <ssb-profile-link v-bind:key="friend" v-bind:feedId="friend"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2 v-if="blocked">{{ $t('profile.blocking') }}</h2>
         <div id="blocked">
           <div v-for="block in blocked">
             <ssb-profile-link v-bind:key="block" v-bind:feedId="block"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2>{{ $t('profile.lastXMessagesFor', { count: 25 }) }} {{ name }} <div style='font-size: 15px'>({{ feedId }})</div></h2>
         <button v-if="canDownloadProfile" class="clickButton" v-on:click="downloadFollowing">{{ $t('profile.downloadFollowing') }}</button>
         <button v-if="canDownloadProfile" class="clickButton" v-on:click="downloadProfile">{{ $t('profile.downloadProfile') }}</button>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
         <button class="clickButton" v-on:click="loadMore">{{ $t('profile.loadMore') }}</button>
         <button v-if="canDownloadMessages" class="clickButton" v-on:click="downloadMessages">{{ $t('profile.downloadLatestMessages') }}</button>

         <transition name="modal" v-if="showExportKey">
           <div class="modal-mask">
             <div class="modal-wrapper">
               <div class="modal-container">
                 <div>
                   <b>{{ $t('profile.showMnemonicCodeAbout') }}</b>
                   <div style="padding-top: 10px;">
                     {{ $t('profile.showMnemonicCodeWarning') }}
                   </div>
                 </div>

                 <div class="modal-body">
                   {{ mnemonic }}
                 </div>

                 <div class="modal-footer">
                   <button class="modal-default-button clickButton" @click="showExportKey = false">
                     {{ $t('common.close') }}
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
                   <b>{{ $t('profile.enterMnemonicCodeAbout') }}</b>
                   <div style="padding-top: 10px;">
                     {{ $t('profile.enterMnemonicCodeWarning') }}
                   </div>
                 </div>

                 <div class="modal-body">
                    <textarea :placeholder="$t('profile.enterMnemonicCodePlaceholder')" v-model="mnemonic"></textarea><br>
                 </div>

                 <div class="modal-footer">
                    <button class="modal-default-button clickButton" style="margin-left: 20px;" v-on:click="restoreKey">
                      {{ $t('profile.restoreFeed') }}
                   </button>
                   <button class="modal-default-button clickButton" @click="showImportKey = false">
                     {{ $t('common.close') }}
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
      followText: function() { return this.following ? this.$root.$t('profile.unfollow') : this.$root.$t('profile.follow') },
      blockText: function() { return this.blocking ? this.$root.$t('profile.unblock') : this.$root.$t('profile.block') },
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

        // FIXME: this won't work
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

        SSB.db.publish(msg, (err) => {
          if (err) return alert(err)

          alert("Saved!")
        })
      },

      changeFollowStatus: function() {
        var self = this
        if (this.following) {
          SSB.db.publish({
            type: 'contact',
            contact: this.feedId,
            following: false
          }, () => {
            alert(self.$root.$t('profile.unfollowed')) // FIXME: proper UI
          })
        } else {
          SSB.db.publish({
            type: 'contact',
            contact: this.feedId,
            following: true
          }, () => {
            alert(self.$root.$t('profile.followed')) // FIXME: proper UI
            // wait for db sync
            SSB.connectedWithData(() => {
              SSB.db.getIndex('contacts').getGraphForFeed(SSB.net.id, () => SSB.net.sync(SSB.getPeer()))
            })
          })
        }
      },

      changeBlockStatus: function() {
        var self = this
        if (this.blocking) {
          SSB.db.publish({
            type: 'contact',
            contact: this.feedId,
            blocking: false
          }, () => {
            alert(self.$root.$t('profile.unblocked')) // FIXME: proper UI
          })
        } else {
          SSB.db.publish({
            type: 'contact',
            contact: this.feedId,
            blocking: true
          }, () => {
            SSB.db.deleteFeed(this.feedId, (err) => {
              if (err) {
                alert(self.$root.$t('profile.blockedButNotDeleted'))
              } else {
                alert(self.$root.$t('profile.blocked')) // FIXME: proper UI

                this.$router.push({ path: '/public'})
              }
	    })
          })
        }
      },

      deleteFeed: function() {
        var self = this
        SSB.db.deleteFeed(this.feedId, (err) => {
          if (err) return alert(self.$root.$t('profile.failedToRemoveFeed'), err)

          this.$router.push({ path: '/public'})
        })
      },

      downloadMessages: function() {
        SSB.connectedWithData(() => {
          if (this.feedId == SSB.net.id)
            SSB.syncFeedFromSequence(this.feedId, 0, this.renderProfile)
          else {
            SSB.syncFeedFromLatest(this.feedId, () => {
              SSB.partial.updateState(this.feedId, { syncedMessages: true }, () => {
                SSB.db.onDrain(this.renderProfile)
              })
            })
          }
	})
      },
      
      downloadProfile: function() {
        SSB.connectedWithData(() => {
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
  
              SSB.partial.updateState(this.feedId, { syncedProfile: true }, () => {
                SSB.db.onDrain(this.renderProfile)
              })
            })
          )
	})
      },

      downloadFollowing: function() {
        SSB.connectedWithData(() => {
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
  
              SSB.partial.updateState(this.feedId, { syncedContacts: true }, () => {
                SSB.db.onDrain(this.renderProfile)
              })
            })
          )
	})
      },

      loadMore: function() {
        SSB.db.query(
          and(author(this.feedId), type('post'), isPublic()),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results)
            this.offset += answer.results.length
          })
        )
      },

      renderProfile: function () {
        var self = this
        const contacts = SSB.db.getIndex('contacts')
        contacts.getGraphForFeedHops1(self.feedId, (err, graph) => {
          self.friends = graph.following
          self.blocked = graph.blocking

          self.following = self.feedId != SSB.net.id && contacts.isFollowing(SSB.net.id, self.feedId)
          self.blocking = self.feedId != SSB.net.id && contacts.isBlocking(SSB.net.id, self.feedId)
        })

        document.body.classList.add('refreshing')

        console.time("latest 25 profile messages")
        SSB.db.query(
          and(author(this.feedId), type('post'), isPublic()),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            const results = answer.results
            this.messages = results
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
      document.title = this.$root.appTitle + " - " + this.$root.$t('profile.title', { name: this.feedId })

      this.renderProfile()
    },

    watch: {
      name: function (newValue, oldValue) {
        // Do this here so it isn't possibly fired off by renderProfile() running SSB.db.query() inside of beforeRouteUpdate(), which messes up the history.
        document.title = this.$root.appTitle + " - " + this.$root.$t('profile.title', { name: this.name })
      }
    }
  }
}
