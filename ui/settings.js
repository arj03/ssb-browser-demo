module.exports = function () {
  return {
    template: `<div id="settings">
	<div class="settingsleft">
	<button id="syncData" v-on:click="syncData">Sync data</button><br>
	<input type="text" placeholder="remote peer" v-model="remoteAddress" id="remoteAddress" />
	<br><br>
	<input type="text" placeholder="onboard blob url" v-model="blobId" v-on:keyup.enter="loadOnboardBlob" value="" id="blobId" />
	<br><br>
	Sync only feeds I'm following <input type="checkbox" id="syncOnlyFollows" v-model="syncOnlyFollows" />
        <br><br>
      </div>
      <div id="status"></div>
    </div>`,

    data: function() {
      return {
        syncOnlyFollows: false,
        remoteAddress: 'ws:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519',
        blobId: ''
      }
    },

    methods: {
      syncData: function(ev) {
        if (SSB.db.getStatus().since <= 0) {
          if (!SSB.onboard) {
            alert("Must provide onboard blob url first")
            return
          }

          SSB.initialSync()
          alert("Initial load can take a while")
        } else
          SSB.sync()
      },

      loadOnboardBlob: function()
      {
        if (this.blobId != '') {
          SSB.net.blobs.remoteGet(this.blobId, "text", (err, data) => {
            if (err) return console.error(err)

            SSB.onboard = JSON.parse(data)
            console.log("Loaded onboarding blob")
          })
        }
      }
    },

    watch: {
      syncOnlyFollows: function (newValue, oldValue) {
        localStorage['settings'] = JSON.stringify(settings)
      },
      remoteAddress: function (newValue, oldValue) {
        localStorage['settings'] = JSON.stringify(settings)
      }
    },

    created: function () {
      if (localStorage['settings']) {
        settings = JSON.parse(localStorage['settings'])
        this.syncOnlyFollows = settings.syncOnlyFollows
        this.remoteAddress = settings.remoteAddress
      }
    },

    /*
    beforeRouteEnter: function() {
      
      // FIXME:?
      var lastStatus = null
      
      function updateDBStatus() {
        setTimeout(() => {
          if (typeof SSB === 'undefined') {
            updateDBStatus()
            return
          }

          const status = SSB.db.getStatus()

          if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
            updateDBStatus()

            return
          }

          lastStatus = status

          var statusHTML = "<b>DB status</b>"
          if (status.since == 0 || status.since == -1) // sleeping
            statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&FT0Klmzl45VThvWQIuIhmGwPoQISP+tZTduu/5frHk4=.sha256')}'/>`
          else if (!status.sync) // hammer time
            statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&IGPNvaqpAuE9Hiquz7VNFd3YooSrEJNofoxUjRMSwww=.sha256')}'/>`
          else { // dancing
            statusHTML += `<img class='indexstatus' src='${SSB.net.blobs.remoteURL('&utxo7ToSNDhHpXpgrEhJo46gwht7PBG3nIgzlUTMmgU=.sha256')}'/>`
          }

          statusHTML += "<br><pre>" + JSON.stringify(status, null, 2) + "</pre>"

          //document.getElementById("status").innerHTML = statusHTML

          updateDBStatus()
        }, 1000)
      }
    },
    
    beforeRouteLeave: function() {

    }
    */
  }
}
