module.exports = function () {
  return {
    template: `
    <div id="settings">
        <div class="settingsleft">
          <b>Remote server</b>
          <br><br>
          <input type="text" placeholder="remote peer" v-model="remoteAddress" id="remoteAddress" />
        </div>
        <div id="status" v-html="statusHTML"></div>

        <div id="build">
          <h3>Reproducible build</h3>
          {{ buildhash }}
        </div>
    </div>`,

    data: function() {
      return {
        remoteAddress: 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519',
        statusHTML: '',
        running: true,

        buildhash: '',
      }
    },

    watch: {
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
        SSB.remoteAddress = this.remoteAddress = settings.remoteAddress
      }

      var self = this

      var req = new XMLHttpRequest()
      req.open("GET", "sha256.txt", true)
      req.onreadystatechange = function() {
        if (req.readyState == 4) {
          self.buildhash = req.response.split(" ")[0]
        }
      }
      req.send()

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
