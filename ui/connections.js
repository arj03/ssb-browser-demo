module.exports = function () {
  return {
    template: `
    <div id="connections">
      <div>
      </div>
      <div>
        <h3>Add pub server or room</h3>
        <select v-model="type">
           <option value='pub'>Pub</option>
           <option value='room'>Room</option>
        </select>
        <input type="text" placeholder="remote address" v-model="address" id="remoteAddress" />
        <button class="clickButton" v-on:click="add">Add</button>
      </div>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        type: 'pub',
        address: 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=',

        statusHTML: '',
        running: true,
      }
    },

    methods: {
      add: function() {
        var s = this.address.split(":")
        SSB.net.connectAndRemember(this.address, {
          key: '@' + s[s.length-1] + '.ed25519',
          type: this.type
        })
      }
    },

    created: function() {
      var self = this

      var lastStatus = null
      var lastEbtStatus = null

      function updateDBStatus() {
        if (!self.running) return

        setTimeout(() => {
          const status = SSB.db.getStatus()
          const ebtStatus = SSB.net.ebt.peerStatus(SSB.net.id)

          if (JSON.stringify(status) == JSON.stringify(lastStatus) &&
              JSON.stringify(ebtStatus) == JSON.stringify(lastEbtStatus)) {
            updateDBStatus()

            return
          }

          lastStatus = status
          lastEbtStatus = ebtStatus

          var html = "<h3>DB status</h3>"
          html += "<pre>" + JSON.stringify(status, null, 2) + "</pre>"
          html += "<h3>EBT status</h3>"
          html += "<pre>" + JSON.stringify(ebtStatus, null, 2) + "</pre>"
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
