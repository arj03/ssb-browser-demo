module.exports = function () {
  return {
    template: `<div id="settings">
        <div class="settingsleft">
        <button id="syncData" v-on:click="syncData">Sync data</button><br>
        <input type="text" placeholder="remote peer" v-model="remoteAddress" id="remoteAddress" />
        <br><br>
        <input type="text" placeholder="onboard blob url" v-model="blobId" v-on:keyup.enter="loadOnboardBlob" value="" class="textInput" />
        <br><br>
        <input type="text" placeholder="open invite code" v-model="inviteCode" v-on:keyup.enter="openInvite" value="" class="textInput" />
        <br><br>
        <input type="text" placeholder="accept invite code" v-model="inviteCode" v-on:keyup.enter="acceptInvite" value="" class="textInput" />
        <br><br>
        Sync only feeds I'm following <input type="checkbox" id="syncOnlyFollows" v-model="syncOnlyFollows" />
        <br><br>
      </div>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        syncOnlyFollows: false,
        remoteAddress: 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519',
        blobId: '',
        statusHTML: '',
        inviteCode: '',
        running: true
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
            if (err) return alert(err)

            var user = msg.value.author
            if (SSB.profiles[msg.value.author])
              user = SSB.profiles[msg.value.author].name
            alert(`User ${user} has invited you, he included the following personal message: '${msg.opened.private}', and the following public message: '${msg.opened.reveal}'`)
          })
        }
      },

      acceptInvite: function()
      {
        if (this.inviteCode != '') {
          SSB.db.peerInvites.acceptInvite(this.inviteCode, (err, msg) => {
            if (err) return alert(err)

            alert("Invite accepted!")
          })
        }
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
