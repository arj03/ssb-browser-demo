module.exports = function () {
  return {
    template: `
    <div id="settings">
      <div>
        <h3>Remote server</h3>
        <input type="text" placeholder="remote peer" v-model="remoteAddress" id="remoteAddress" />
      </div>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        remoteAddress: 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=',

        statusHTML: '',
        running: true,
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

      var lastStatus = null

      /*
      SSB.net.blobs.remoteGet("&iRW9+26q1StUywvh0dp6TRU3uF1Ay0UuTAsuM8IEhNE=.sha256", "text", (err, data) => {
        if (err) return alert(err)
        
        console.log(JSON.parse(data))
      })
      */
      
      function updateDBStatus() {
        if (!self.running) return

        setTimeout(() => {
          const status = SSB.db.getStatus()

          if (JSON.stringify(status) == JSON.stringify(lastStatus)) {
            updateDBStatus()

            return
          }

          lastStatus = status

          var html = "<h3>DB status</h3>"
          html += "<pre>" + JSON.stringify(status, null, 2) + "</pre>"
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
