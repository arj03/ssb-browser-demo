module.exports = function () {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const md = require('./markdown')
  const userGroups = require('../usergroups')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')
  
  let initialState = function(self) {
    return {
      componentStillLoaded: false,
      isSelf: false,
      following: false,
      blocking: false,
      name: '',
      image: 'assets/noavatar.svg',
      imageBlobId: '',
      descriptionText: '',
      messages: [],
      canDownloadMessages: true,
      canDownloadProfile: true,
      showFriends: true,
      showBlocked: false,
      showFollowers: false,
      showBlockingUs: false,
      friends: [],
      followers: [],
      blocked: [],
      blockingUs: [],
      waitingForBlobURLs: 0,

      showExportKey: false,
      showImportKey: false,
      mnemonic: '',

      group: '',
      alreadyInGroup: false,
      groups: [],

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
           </div>
           <div class="description">
             <input id="name" type="text" v-model="name" :placeholder="$t('profile.profileNamePlaceholder')">
             <br>
             <markdown-editor :placeholder="$t('profile.profileDescriptionPlaceholder')" :initialValue="descriptionText" ref="markdownEditor" />
           </div>
         </span>
         <span v-else>
           <div v-bind:class="{ avatar: true, blockedAvatar: blocking }">
             <img :src='image'><br>
             <span v-if="blocking" class="blockedSymbol">🚫</span>
           </div>
           <div class="description">
             <h2 class="profileName">{{ name }}</h2>
             <span v-html="description"></span>
           </div>
         </span>
         <div class="profileButtons" v-if="isSelf">
           <button class="clickButton" v-on:click="saveProfile">{{ $t('profile.saveProfile') }}</button>
           <hr />
           <button class="clickButton" v-on:click="exportKey">{{ $t('profile.exportKey') }}</button>
           <button class="clickButton" v-on:click="showImportKey = true">{{ $t('profile.loadKey') }}</button>
         </div>
         <div class="profileButtons" v-else>
           <router-link class="clickButton" tag="button" :to="{name: 'private-feed', params: { feedId: feedId }}">{{ $t('profile.sendMessage') }}</router-link>
           <button class="clickButton" v-on:click="changeFollowStatus">{{ followText }}</button>
           <button class="clickButton" v-on:click="changeBlockStatus">{{ blockText }}</button>
           <button class="clickButton" v-on:click="deleteFeed">{{ $t('profile.removeFeed') }} &#x2622</button><br>
           <span class="addToGroup">
             <v-select :placeholder="$t('profile.groupDropdownPlaceholder')" v-model="group" :options="groups" label="name" @input="groupChange"></v-select>
             <button v-if="!alreadyInGroup" class="clickButton" v-on:click="addToGroup">{{ $t('profile.addToGroup') }}</button>
             <button v-if="alreadyInGroup" class="clickButton" v-on:click="removeFromGroup">{{ $t('profile.removeFromGroup') }}</button>
           </span>
           <br><br>
         </div>
         <h2 v-if="friends"><a href="javascript:void(0)" @click="showFriends=!showFriends"><span v-if="showFriends">▼</span><span v-if="!showFriends">►</span>&nbsp;{{ $t('profile.following') }} ({{ friends.length }})</a></h2>
         <div v-if="showFriends" id="follows">
           <div v-for="friend in friends">
             <ssb-profile-link v-bind:key="friend" v-bind:feedId="friend"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2 v-if="blocked"><a href="javascript:void(0)" @click="showBlocked=!showBlocked"><span v-if="showBlocked">▼</span><span v-if="!showBlocked">►</span>&nbsp;{{ $t('profile.blocking') }} ({{ blocked.length }})</a></h2>
         <div v-if="showBlocked" id="blocked">
           <div v-for="block in blocked">
             <ssb-profile-link v-bind:key="block" v-bind:feedId="block"></ssb-profile-link>
           </div>
         </div>
         <div style="clear: both;"></div>
         <h2 v-if="followers && followers.length > 0"><a href="javascript:void(0)" @click="showFollowers=!showFollowers"><span v-if="showFollowers">▼</span><span v-if="!showFollowers">►</span>&nbsp;{{ $t('profile.followers', { name: (isSelf ? $t('common.selfPronoun') : name) }) }} ({{ followers.length }})</a></h2>
         <div v-if="followers && followers.length > 0 && showFollowers" id="followers">
           <div v-for="friend in followers">
             <ssb-profile-link v-bind:key="friend" v-bind:feedId="friend"></ssb-profile-link>
           </div>
         </div>
         <div v-if="followers && followers.length > 0" style="clear: both;"></div>
         <h2 v-if="blockingUs && blockingUs.length > 0"><a href="javascript:void(0)" @click="showBlockingUs=!showBlockingUs"><span v-if="showBlockingUs">▼</span><span v-if="!showBlockingUs">►</span>&nbsp;{{ $t('profile.blockingUs', { name: (isSelf ? $t('common.selfPronoun') : name) }) }} ({{ blockingUs.length }})</a></h2>
         <div v-if="blockingUs && blockingUs.length > 0 && showBlockingUs" id="blockingUs">
           <div v-for="friend in blockingUs">
             <ssb-profile-link v-bind:key="friend" v-bind:feedId="friend"></ssb-profile-link>
           </div>
         </div>
         <div v-if="blockingUs && blockingUs.length > 0" style="clear: both;"></div>
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
      return initialState(this)
    },

    computed: {
      followText: function() { return this.following ? this.$root.$t('profile.unfollow') : this.$root.$t('profile.follow') },
      blockText: function() { return this.blocking ? this.$root.$t('profile.unblock') : this.$root.$t('profile.block') },
      description: function() { return md.markdown(this.descriptionText) }
    },
    
    methods: {
      groupChange: function() {
        var self = this
        if (this.group && this.group.id && this.group.id != '') {
          userGroups.getMembers(this.group.id, (err, groupId, members) => {
            self.alreadyInGroup = (members.indexOf(this.feedId) >= 0)
          })
        }
      },

      addToGroup: function() {
        var self = this
        if (!this.group || !this.group.id || this.group.id == '') {
          alert(this.$root.$t('profile.chooseGroupFirst'))
          return
        }
        userGroups.addMember(this.group.id, this.feedId, (err, success) => {
          if (err) {
            alert(err)
            return
          }

          self.alreadyInGroup = true
        })
      },

      removeFromGroup: function() {
        var self = this
        if (!this.group || !this.group.id || this.group.id == '') {
          alert(this.$root.$t('profile.chooseGroupFirst'))
          return
        }
        userGroups.removeMember(this.group.id, this.feedId, (err, success) => {
          if (err) {
            alert(err)
            return
          }

          self.alreadyInGroup = false
        })
      },

      cacheImageURLForPreview: function(blobId, cb) {
        var self = this;
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net || !SSB.net.blobs) {
          // Not going to hurt anything to try again later.
          setTimeout(function() {
            self.cacheImageURLForPreview(blobId, cb)
          }, 3000)
          return
        }

        ++this.waitingForBlobURLs
        SSB.net.blobs.fsURL(blobId, (err, blobURL) => {
          if (self.$refs.markdownEditor)
            self.$refs.markdownEditor.addBlobURLToCache(blobId, blobURL)

          // If this is the last blob we were waiting for, call the callback.
          --self.waitingForBlobURLs
          if (self.waitingForBlobURLs == 0)
            cb(null, true)
        })
      },

      onFileSelect: function(ev) {
        const file = ev.target.files[0]

        if (!file) return

        var self = this;
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net || !SSB.net.blobs) {
          alert("Can't add file right now.  Database couldn't be locked.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

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

        localStorage["/.ssb-lite/restoreFeed"] = "true"

        alert(this.$root.$t('profile.reloadAfterImport'))
      },

      saveProfile: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net || !SSB.db) {
          alert("Can't save right now.  Database couldn't be locked.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

        this.descriptionText = this.$refs.markdownEditor.getMarkdown()

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

        // Make sure the full post (including headers) is not larger than the 8KiB limit.
        if (JSON.stringify(msg).length > 8192) {
          alert(this.$root.$t('common.postTooLarge'))
          return
        }

        SSB.db.publish(msg, (err) => {
          if (err) return alert(err)

          // Re-render the lower nav menu.
          if (this.imageBlobId != '') {
            this.$root.$refs["upperNavProfileLink"].renderProfile({ name: this.$root.$t('common.selfPronoun'), imageURL: this.image })
            this.$root.$refs["lowerNavProfileLink"].renderProfile({ name: this.$root.$t('common.selfPronoun'), imageURL: this.image })
          }

          alert("Saved!")
        })
      },

      changeFollowStatus: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        var self = this
        if (!SSB || !SSB.db) {
          alert("Can't change follow status right now.  Database couldn't be locked.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

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
            SSB.connectedWithData(() => {
              SSB.net.db.onDrain('contacts', () => {
                SSB.net.sync(SSB.getPeer())
              })
            })
          })
        }
      },

      changeBlockStatus: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.db) {
          alert("Can't change blocking status right now.  Database couldn't be locked.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

        var self = this
        if (this.blocking) {
          SSB.db.publish({
            type: 'contact',
            contact: this.feedId,
            blocking: false
          }, () => {
            self.blocking = false
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
                self.blocking = true
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
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.db) {
          alert("Can't delete feed right now.  Database couldn't be locked.  Please make sure you only have one running instance of ssb-browser.")
          return
        }

        var self = this
        SSB.db.deleteFeed(this.feedId, (err) => {
          if (err) return alert(self.$root.$t('profile.failedToRemoveFeed'), err)

          this.$router.push({ path: '/public'})
        })
      },

      downloadMessages: function() {
        var self = this
        ssbSingleton.getSSBEventually(5000, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db && SSB.isConnectedWithData() }, self.downloadFollowingCallback)
      },

      downloadMessagesCallback: function(err, SSB) {
        if (err) {
          alert("Can't download right now.  Reason: " + err)
          return
        }

        if (this.feedId == SSB.net.id)
          SSB.syncFeedFromSequence(this.feedId, 0, this.renderProfile)
        else {
          SSB.syncFeedFromLatest(this.feedId, () => {
            SSB.partial.updateState(this.feedId, { syncedMessages: true }, () => {
              SSB.db.onDrain(this.renderProfile)
            })
          })
        }
      },
      
      downloadProfile: function() {
        var self = this
        ssbSingleton.getSSBEventually(5000, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db && SSB.isConnectedWithData() }, self.downloadFollowingCallback)
      },

      downloadProfileCallback: function(err, SSB) {
        if (err) {
          alert("Can't download right now.  Reason: " + err)
          return
        }

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
      },

      downloadFollowing: function() {
        var self = this
        ssbSingleton.getSSBEventually(5000, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db }, self.downloadFollowingCallback)
      },

      downloadFollowingCallback: function(err, SSB) {
        if (err) {
          alert("Can't download right now.  Reason: " + err)
          return
        }

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

      updateFollowers: function(err, SSB) {
        var self = this
        var opts = {
          start: this.feedId,
          max: 1,
          reverse: true
        }
        SSB.net.friends.hops(opts, (err, feeds) => {
          var newFollowers = []
          for(f in feeds) {
            if (feeds[f] > 0)
              newFollowers.push(f)
          }
          self.followers = newFollowers
        })
      },

      updateBlockingUs: function(err, SSB) {
        var self = this
        var opts = {
          start: this.feedId,
          max: 0,
          reverse: true
        }
        SSB.net.friends.hops(opts, (err, feeds) => {
          var newBlocks = []
          for(f in feeds) {
            if (Math.round(feeds[f]) == -1)
              newBlocks.push(f)
          }
          self.blockingUs = newBlocks
        })
      },

      loadMore: function() {
        var self = this
        ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db }, self.loadMoreCallback)
      },

      loadMoreCallback: function (err, SSB) {
        const { where, and, or, author, type, isPublic, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        SSB.db.query(
          where(
            and(
              author(this.feedId),
              or(
                type('post'),
                type('about'),
                type('contact')
              ),
              isPublic()
            )
          ),
          startFrom(this.offset),
          paginate(25),
          descending(),
          toCallback((err, answer) => {
            this.messages = this.messages.concat(answer.results)
            this.offset += answer.results.length
          })
        )
      },

      renderFollowsCallback: function (err, SSB) {
        const { where, and, or, author, type, isPublic, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        var self = this

        self.isSelf = (SSB.net.id == this.feedId)

        SSB.getGraphForFeed(self.feedId, (err, graph) => {
          self.friends = graph.following
          self.blocked = graph.blocking

          SSB.net.friends.isFollowing({ source: SSB.net.id, dest: self.feedId }, (err, result) => {
            self.following = result
          })

          SSB.net.friends.isBlocking({ source: SSB.net.id, dest: self.feedId }, (err, result) => {
            self.blocking = result
          })
        })

        userGroups.getGroups((err, groups) => {
          if (groups) {
            const sortFunc = (new Intl.Collator()).compare
            self.groups = groups.sort((a, b) => { return sortFunc(a.name, b.name) })
          }
        })

        document.body.classList.add('refreshing')

        console.time("latest 25 profile messages")
        SSB.db.query(
          where(
            and(
              author(this.feedId),
              or(
                type('post'),
                type('about'),
                type('contact')
              ),
              isPublic()
            )
          ),
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

        this.updateFollowers(err, SSB)
        this.updateBlockingUs(err, SSB)
      },
      
      renderProfileCallback: function (err, SSB) {
        var self = this
        const profile = SSB.getProfile(self.feedId)
        if (profile.name)
          self.name = profile.name
          
        if (profile.description) {
          self.descriptionText = profile.description
            
          if (self.feedId == SSB.net.id) {
            // Editing self.
            // Check for images.  If there are any, cache them.
            var blobRegEx = /!\[[^\]]*\]\((&[^\.]+\.sha256)\)/g
            var blobMatches = [...this.descriptionText.matchAll(blobRegEx)]
            for (b in blobMatches)
              self.cacheImageURLForPreview(blobMatches[b][1], (err, success) => {
                // Reload the editor with the new image.
                // This is only triggered when the last image is loaded.
                // Set it to something different and back again to get it to refresh the preview.
                if (self.$refs.markdownEditor) {
                  self.$refs.markdownEditor.setMarkdown(self.descriptionText + " ")
                  self.$refs.markdownEditor.setMarkdown(self.descriptionText)
                }
              })
              
            // Load the editor.
            if (self.$refs.markdownEditor) {
              if (blobMatches.length == 0) {
                // If we're not waiting for any images to load, load the editor right away.
                self.$refs.markdownEditor.setMarkdown(self.descriptionText)
              }
            }
          }
        }
  
        if (profile.imageURL) {
          self.image = profile.imageURL
          self.imageBlobId = profile.image
        } else if (profile.image) {
          SSB.net.blobs.localGet(profile.image, (err, url) => {
            if (!err) {
              self.image = url
              self.imageBlobId = profile.image
            }
          })
        }
      },

      renderProfile() {
        var self = this
        ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db && SSB.net && SSB.dbOperators && SSB.getGraphForFeed }, self.renderFollowsCallback)
        ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.db && SSB.net && SSB.getProfile && (profile = SSB.getProfile(self.feedId)) && Object.keys(profile).length > 0 }, self.renderProfileCallback)
      }
    },

    beforeRouteUpdate(to, from, next) {
      this.feedId = to.params.feedId
      Object.assign(this.$data, initialState(this))
      this.componentStillLoaded = true
      this.renderProfile()
      next()
    },

    created: function () {
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('profile.title', { name: this.feedId })

      this.renderProfile()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    },

    watch: {
      name: function (newValue, oldValue) {
        // Do this here so it isn't possibly fired off by renderProfile() running SSB.db.query() inside of beforeRouteUpdate(), which messes up the history.
        document.title = this.$root.appTitle + " - " + this.$root.$t('profile.title', { name: this.name })
      }
    }
  }
}
