const pull = require('pull-stream')

module.exports = function () {
  return {
    template: `
    <div id="connections">
      <div>
      </div>
      <div>
        <h3>Add pub server or room</h3>
        <select v-model="type" v-on:change="onTypeChange(this.value)">
           <option value='room'>Room</option>
           <option value='pub'>Pub</option>
        </select>
        <input type="text" placeholder="remote address" v-model="address" v-on:keyup.enter="add" id="remoteAddress" />
        <button class="clickButton" v-on:click="add">Add</button>
      </div>
      <h3>Possible connections</h3>
      <div v-for="stagedPeer in stagedPeers">
        <button class="clickButton" v-on:click="connect(stagedPeer)">Connect to {{ stagedPeer.data.key }}</button>
      </div>
      <h3>Connections</h3>
      <div v-for="peer in peers">
        <button class="clickButton" v-on:click="disconnect(peer)">Disconnect</button> from {{ peer.data.key }}
      </div>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        type: 'room',
        address: '',

        statusHTML: '',
        running: true,
        stagedPeers: [],
        peers: []
      }
    },

    methods: {
      onTypeChange: function() {
        if (this.type == 'room')
          this.address = 'wss:between-two-worlds.dk:9999~shs:7R5/crt8/icLJNpGwP2D7Oqz2WUd7ObCIinFKVR6kNY='
        else
          this.address = 'wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8='
      },

      add: function() {
        var s = this.address.split(":")
        SSB.net.connectAndRemember(this.address, {
          key: '@' + s[s.length-1] + '.ed25519',
          type: this.type
        })
      },
      connect: function(stagedPeer) {
        SSB.net.connectAndRemember(stagedPeer.address, stagedPeer.data)
      },
      disconnect: function(peer) {
        SSB.net.conn.disconnect(peer.address)
      }
    },

    created: function() {
      var self = this

      self.onTypeChange()

      var lastStatus = null
      var lastEbtStatus = null

      pull(
        SSB.net.conn.stagedPeers(),
        pull.drain((entries) => {
          self.stagedPeers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
        })
      )

      pull(
        SSB.net.conn.peers(),
        pull.drain((entries) => {
          self.peers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
        })
      )

      function updateDBStatus() {
        if (!self.running) return

        setTimeout(() => {
          const status = Object.assign(SSB.db.getStatus(), SSB.feedSyncer.status())
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
