module.exports = function () {
  return {
    template: `
    <div id="settings">
        <div class="settingsleft">
          <button class="clickButton" id="syncData" v-on:click="syncData">Sync data</button><br>
          <input type="text" placeholder="remote peer" v-model="remoteAddress" id="remoteAddress" />
          <br><br>
          <input type="text" placeholder="onboard blob url" v-model="blobId" v-on:keyup.enter="loadOnboardBlob" value="" class="textInput" />
          <br><br>
          Sync only feeds I'm following <input type="checkbox" id="syncOnlyFollows" v-model="syncOnlyFollows" />
          <br><br>
        </div>
        <div id="status" v-html="statusHTML"></div>

        <div id="peerinvites">
          <h3>Use peer invite</h3>
          <input type="text" placeholder="invite code" v-model="inviteCode" value="" class="textInput" />
          <br>
          <button class="clickButton" v-on:click="openInvite">Check invite code</button>
          <button class="clickButton" v-on:click="acceptInvite">Accept invite code</button>
          <h3>Create personal peer invite</h3>
          <div id="inviteDescription">Create a personal peer invite
          code for someone to join Scuttlebutt. You can include people
          you think the person might like in the invitation.</div>
          <input type="text" placeholder="private message for invite" v-model="private" value="" class="textInput" />
          <br>
          <input type="text" placeholder="public reveal message for invite" v-model="reveal" value="" class="textInput" />
          <br><br>
          Add people (optional):
          <v-select multiple v-model="selectedPeople" :options="people" label="name">
            <template slot="option" slot-scope="option">
              <img v-if='option.image' class="tinyAvatar" :src='option.image' />
              <span>{{ option.name }}</span>
            </template>
          </v-select>
          <button class="clickButton" v-on:click="createInvite">Create invite code</button>
        </div>

        <transition name="modal" v-if="showNewInviteModal">
          <div class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <div>
                  An invite code has been generated, share this with your friend using something like email or signal.
                </div>

                <div class="modal-body">
                  {{ createdInviteCode }}
                </div>

                <div class="modal-footer">
                  <button class="clickButton" v-on:click="copyInviteToClipboard">
                    Copy to clipboard
                  </button>
                  <button class="modal-default-button clickButton" @click="showNewInviteModal = false">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <transition name="modal" v-if="showOpenInviteModal">
          <div class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <div>
                  <b>The user {{ openInviteUser }} has sent you an invite to connect</b>
                </div>

                <div class="modal-body">
                  The message includes the following personal message: {{ openInvitePrivateMsg }}<br>
                  <br>
                  And includes the following people for you to check out:<br>
                  <div v-for="people in openInvitePeople">
                    {{ people.name }}
                  </div>
                  <br>
                  Once accepted, the following public message will be shown: {{ openInviteRevealMsg }}<br>
                </div>

                <div class="modal-footer">
                  <button class="modal-default-button clickButton" style="margin-left: 20px;" v-on:click="acceptInvite">
                    Accept invite
                  </button>
                  <button class="modal-default-button clickButton" @click="showOpenInviteModal = false">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
    </div>`,

    data: function() {
      return {
        syncOnlyFollows: false,
        remoteAddress: 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519',
        blobId: '',
        statusHTML: '',
        inviteCode: '',
        running: true,
        private: '',
        reveal: '',
        people: [],
        selectedPeople: [],

        showNewInviteModal: false,
        createdInviteCode: '',

        showOpenInviteModal: false,
        openInviteUser: '',
        openInvitePrivateMsg: '',
        openInviteRevealMsg: '',
        openInvitePeople: []
      }
    },

    methods: {
      syncData: function(ev) {
        if (SSB.db.getStatus().since <= 0) {
          if (!SSB.onboard && this.blobId != '') {
            SSB.net.blobs.remoteGet(this.blobId, "text", (err, data) => {
              if (err) return alert(err)

              SSB.onboard = JSON.parse(data)

              SSB.initialSync()
              alert("Initial load can take a while")
            })
          }
          else if (!SSB.onboard) {
            alert("Must provide onboard blob url first")
            return
          }
          else {
            SSB.initialSync()
            alert("Initial load can take a while")
          }
        } else
          SSB.sync()
      },

      loadOnboardBlob: function()
      {
        if (this.blobId != '') {
          SSB.net.blobs.remoteGet(this.blobId, "text", (err, data) => {
            if (err) return alert(err)

            SSB.onboard = JSON.parse(data)
            alert("Loaded onboarding blob")
          })
        }
      },

      openInvite: function()
      {
        if (this.inviteCode != '') {
          SSB.db.peerInvites.openInvite(this.inviteCode, (err, msg) => {
            if (err) return alert(err.message)

            var user = msg.value.author
            if (SSB.profiles[msg.value.author] && SSB.profiles[msg.value.author].name)
              user = SSB.profiles[msg.value.author].name

            let privateMsg = msg.opened.private
            if (typeof msg.opened.private === 'object' && msg.opened.private.msg)
              privateMsg = msg.opened.private.msg

            let people = []
            if (typeof msg.opened.private === 'object' && msg.opened.private.people)
              people = msg.opened.private.people

            this.openInviteUser = user
            this.openInvitePrivateMsg = privateMsg
            this.openInviteRevealMsg = msg.opened.reveal
            this.openInvitePeople = people
            this.showOpenInviteModal = true
          })
        }
      },

      acceptInvite: function()
      {
        if (this.inviteCode != '') {
          SSB.db.peerInvites.acceptInvite(this.inviteCode, (err) => {
            if (err) return alert(err)

            // we need the original invite for the people
            SSB.db.peerInvites.openInvite(this.inviteCode, (err, msg) => {
              let people = []
              if (typeof msg.opened.private === 'object' && msg.opened.private.people)
                people = msg.opened.private.people

              people.forEach(p => {
                if (!(p.id in SSB.profiles)) {
                  SSB.profiles[p.id] = {
                    name: p.name,
                    description: p.description,
                    image: p.image
                  }
                }
                SSB.syncFeedFromSequence(p.id, p.sequence)
              })

              SSB.saveProfiles()
            })

            alert("Invite accepted!")
          })
        }
      },

      copyInviteToClipboard: function() {
        navigator.clipboard.writeText(this.createdInviteCode)
      },

      createInvite: function()
      {
        // make sure we follow the pubs feed in order to get the confirm msg
        const remoteFeed = '@' + this.remoteAddress.split(':')[3]
        if (!(remoteFeed in SSB.profiles))
          SSB.syncFeedAfterFollow(remoteFeed)

        const last = SSB.db.last.get()

        let selected = this.selectedPeople.map(x => {
          let profile = SSB.profiles[x.id]
          let lastMsg = last[x.id]
          return {
            id: x.id,
            name: profile.name,
            image: profile.image,
            description: profile.description,
            sequence: lastMsg ? lastMsg.sequence : null
          }
        })

        // always include self
        if (!(SSB.net.id in selected)) {
          let profile = SSB.profiles[SSB.net.id]
          let lastMsg = last[SSB.net.id]
          selected.push({
            id: SSB.net.id,
            name: profile.name,
            image: profile.image,
            description: profile.description,
            sequence: lastMsg ? lastMsg.sequence : null
          })
        }

        SSB.db.peerInvites.create({
          private: { msg: this.private, people: selected },
          reveal: this.reveal,
          allowWithoutPubs: true,
          pubs: this.remoteAddress
        }, (err, msg) => {
          if (err) return alert(err)

          this.createdInviteCode = msg
          this.showNewInviteModal = true
        })
      }
    },

    watch: {
      syncOnlyFollows: function (newValue, oldValue) {
        localStorage['settings'] = JSON.stringify({
          syncOnlyFollows: this.syncOnlyFollows,
          remoteAddress: this.remoteAddress
        })
      },
      remoteAddress: function (newValue, oldValue) {
        localStorage['settings'] = JSON.stringify({
          syncOnlyFollows: this.syncOnlyFollows,
          remoteAddress: this.remoteAddress
        })
        SSB.remoteAddress = this.remoteAddress
      }
    },

    created: function() {
      if (localStorage['settings']) {
        var settings = JSON.parse(localStorage['settings'])
        this.syncOnlyFollows = settings.syncOnlyFollows
        this.remoteAddress = settings.remoteAddress

        SSB.remoteAddress = settings.remoteAddress
      }

      var self = this

      const last = SSB.db.last.get()

      for (let id in SSB.profiles) {
        const profile = SSB.profiles[id]

        if (profile.image && last[id])
          SSB.net.blobs.localGet(profile.image, (err, url) => {
            self.people.push({
              id: id,
              name: profile.name || id,
              image: err ? '' : url
            })
          })
        else if (last[id])
          self.people.push({
            id: id,
            name: profile.name || id,
            image: ''
          })
      }

      var lastStatus = null

      function updateDBStatus() {
        if (!self.running) return

        setTimeout(() => {
          const status = SSB.db.getStatus()

          if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
            updateDBStatus()

            return
          }

          lastStatus = status

          var html = "<b>DB status</b>"
          if (status.since == 0 || status.since == -1) // sleeping
            html += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&FT0Klmzl45VThvWQIuIhmGwPoQISP+tZTduu/5frHk4=.sha256')}'/>`
          else if (!status.sync) // hammer time
            html += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&IGPNvaqpAuE9Hiquz7VNFd3YooSrEJNofoxUjRMSwww=.sha256')}'/>`
          else { // dancing
            html += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&utxo7ToSNDhHpXpgrEhJo46gwht7PBG3nIgzlUTMmgU=.sha256')}'/>`
          }

          html += "<br><pre>" + JSON.stringify(status, null, 2) + "</pre>"
          self.statusHTML = html

          updateDBStatus()
        }, 1000)
      }

      updateDBStatus()
    },

    beforeRouteLeave: function(from, to, next) {
      this.running = false
      next()
    }
  }
}
