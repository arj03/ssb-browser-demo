const pull = require('pull-stream')
const defaultPrefs = require("../defaultprefs.json")

module.exports = function () {
  return {
    template: `
    <div id="connections">
      <div>
      </div>
      <div>
        <h3>{{ $t('connections.addPeer') }}</h3>
        <select v-model="type" v-on:change="onTypeChange(this.value)">
           <option value='room'>Room</option>
           <option value='pub'>Pub</option>
        </select>
        <input type="text" placeholder="remote address" v-model="address" v-on:keyup.enter="add" id="remoteAddress" />
        <button class="clickButton" v-on:click="add">{{ $t('connections.addPeerButton') }}</button>
      </div>
      <h3>{{ $t('connections.possibleConnections') }}</h3>
      <div v-for="suggestedPeer in suggestedPeers">
        <button class="clickButton" v-on:click="connectSuggested(suggestedPeer)">{{ $t('connections.connectToX', { peer: suggestedPeer.name }) }}</button>
      </div>
      <div v-for="stagedPeer in stagedPeers">
        <button class="clickButton" v-on:click="connect(stagedPeer)">{{ $t('connections.connectToX', { peer: stagedPeer.name || stagedPeer.data.name || stagedPeer.data.key }) }}</button>
      </div>
      <h3>{{ $t('connections.existingConnections') }}</h3>
      <div v-for="peer in peers">
        <button class="clickButton" v-on:click="disconnect(peer)">Disconnect</button> from <router-link :to="{name: 'profile', params: { feedId: peer.data.key }}">{{ peer.name || peer.data.name || peer.data.key }}</router-link>&nbsp;({{ peer.data.type }})<br />
      </div>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        type: 'room',
        address: '',

        statusHTML: '',
        running: true,
        suggestedPeers: [],
        stagedPeers: [],
        peers: []
      }
    },

    methods: {
      onTypeChange: function() {
      },

      add: function() {
        var s = this.address.split(":")
	if (s[0] != 'ws' && s[0] != 'wss' && s[0] != 'dht' && s[0] != 'bt') {
          alert(this.$root.$t('connections.unsupportedConnectionTypeX', { connType: s[0] }))
	  return
	}
        SSB.net.connectAndRemember(this.address, {
          key: '@' + s[s.length-1] + '.ed25519',
          type: this.type
        })
      },
      connectSuggested: function(suggestedPeer) {
        var s = suggestedPeer.address.split(":")
        SSB.net.connectAndRemember(suggestedPeer.address, {
          key: '@' + s[s.length-1] + '.ed25519',
          type: suggestedPeer.type
        })
        this.updateSuggestedPeers()
      },
      updateSuggestedPeers: function() {
        // Load suggested peer list and filter out any we're already connected to.
        if (defaultPrefs.suggestPeers) {
          const peerAddresses = this.peers.map(x => x.address)
          this.suggestedPeers = defaultPrefs.suggestPeers.filter((x) => peerAddresses.indexOf(x.address) < 0)
        }
      },
      connect: function(stagedPeer) {
        SSB.net.connectAndRemember(stagedPeer.address, stagedPeer.data)
        this.updateSuggestedPeers()
      },
      disconnect: function(peer) {
        SSB.net.conn.forget(peer.address)
        SSB.net.conn.disconnect(peer.address)
        this.updateSuggestedPeers()
      }
    },

    created: function() {
      var self = this

      document.title = this.$root.appTitle + " - " + this.$root.$t('connections.title')

      self.onTypeChange()

      var lastStatus = null
      var lastEbtStatus = null

      pull(
        SSB.net.conn.stagedPeers(),
        pull.drain((entries) => {
          self.stagedPeers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
          self.updateSuggestedPeers()
        })
      )

      pull(
        SSB.net.conn.peers(),
        pull.drain((entries) => {
          self.peers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
          self.updateSuggestedPeers()
        })
      )

      function updateDBStatus() {
        if (!self.running) return

        setTimeout(() => {
          const status = Object.assign(SSB.db.getStatus().value, SSB.feedSyncer.status())
          const ebtStatus = SSB.net.ebt.peerStatus(SSB.net.id)

          if (JSON.stringify(status) == JSON.stringify(lastStatus) &&
              JSON.stringify(ebtStatus) == JSON.stringify(lastEbtStatus)) {
            updateDBStatus()

            return
          }

          lastStatus = status
          lastEbtStatus = ebtStatus

          var html = "<h3>" + self.$root.$t('connections.dbStatus') + "</h3>"
          html += "<pre>" + JSON.stringify(status, null, 2) + "</pre>"
          html += "<h3>" + self.$root.$t('connections.ebtStatus') + "</h3>"
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
    },

    watch: {
      stagedPeers: function(oldValue, newValue) {
        var self = this
        for (x in this.stagedPeers) {
          (function(p) {
            var suggestNamesForPeer = defaultPrefs.suggestPeers.filter((x) => x.address == self.stagedPeers[p].address)
            if (suggestNamesForPeer.length > 0)
              self.stagedPeers[p].name = suggestNamesForPeer[0].name
            else if (self.stagedPeers[p].data && self.stagedPeers[p].data.type == 'room-endpoint') {
              var key = self.stagedPeers[p].data.key
              const name = SSB.getProfileName(key)
              // See if we have a room name in our suggestions list.
              var roomName = self.stagedPeers[p].data.roomName
              var suggestNamesForRoom = defaultPrefs.suggestPeers.filter((x) => {
                var r = x.address.split(":")
                var peerKey = '@' + r[r.length-1] + '.ed25519'
                return (peerKey == self.stagedPeers[p].data.room)
              })
              if (suggestNamesForRoom.length > 0)
                roomName = suggestNamesForRoom[0].name

              self.stagedPeers[p].name = (name || key) + (roomName ? " via " + roomName : "")
            }
          })(x)
        }
      },
      peers: function(oldValue, newValue) {
        var self = this
        for (x in this.peers) {
          (function(p) {
            var suggestNamesForPeer = defaultPrefs.suggestPeers.filter((x) => x.address == self.peers[p].address)
            if (suggestNamesForPeer.length > 0)
              self.peers[p].name = suggestNamesForPeer[0].name
            else if (self.peers[p].data && self.peers[p].data.type == 'room-endpoint') {
              var key = self.peers[p].data.key
              const name = SSB.getProfileName(key)
              // See if we have a room name in our suggestions list.
              var roomName = self.peers[p].data.roomName
              var suggestNamesForRoom = defaultPrefs.suggestPeers.filter((x) => {
                var r = x.address.split(":")
                var peerKey = '@' + r[r.length-1] + '.ed25519'
                return (peerKey == self.peers[p].data.room)
              })
              if (suggestNamesForRoom.length > 0)
                roomName = suggestNamesForRoom[0].name

              self.peers[p].name = (name || key) + (roomName ? " via " + roomName : "")
            }
          })(x)
        }
      }
    }
  }
}
