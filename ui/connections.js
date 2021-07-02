const pull = require('pull-stream')
const defaultPrefs = require("../defaultprefs.json")
const localPrefs = require("../localprefs")
const ssbSingleton = require('ssb-browser-core/ssb-singleton')

module.exports = function () {
  return {
    template: `
    <div id="connections">
      <div>
      </div>
      <div>
        <h3>Connection Status</h3>
        <span v-if="online">☒</span><span v-if="!online">☐</span>&nbsp;{{ $t('connections.statusOnline') }}<br />
        <span v-if="connected">☒</span><span v-if="!connected">☐</span>&nbsp;{{ $t('connections.statusConnected') }}<br />
        <span v-if="connectedWithData">☒</span><span v-if="!connectedWithData">☐</span>&nbsp;{{ $t('connections.statusConnectedWithData') }}<br />
        <span v-if="followProgress == 100">☒</span><span v-if="followProgress != 100">☐</span>&nbsp;{{ $t('connections.statusFollowedSyncComplete') }} <span v-if="!hasFollowProgress">{{ $t('connections.statusWaitingForConnection') }}</span></br >
        <div><div class="progressOuter"><div><div class="progressInner" id="syncProgressFollow"></div></div></div>&nbsp;{{ followProgress }}%</div>
        <span v-if="extendedProgress == 100">☒</span><span v-if="extendedProgress != 100">☐</span>&nbsp;{{ $t('connections.statusExtendedSyncComplete') }} <span v-if="!hasFollowProgress">{{ $t('connections.statusWaitingForConnection') }}</span></br >
        <div><div class="progressOuter"><div><div class="progressInner" id="syncProgressExtended"></div></div></div>&nbsp;{{ extendedProgress }}%</div>
        <span v-if="synced">☒</span><span v-if="!synced">☐</span>&nbsp;{{ $t('connections.statusSyncComplete') }}<br />
        <button v-if="online" class="clickButton" v-on:click="goOffline">{{ $t('connections.goOffline') }}</button>
        <button v-if="!online" class="clickButton" v-on:click="goOnline">{{ $t('connections.goOnline') }}</button>
      </div>
      <div v-if="online">
        <div>
          <h3>{{ $t('connections.addPeer') }}</h3>
          <select v-model="type" v-on:change="onTypeChange(this.value)">
             <option value='room'>Room</option>
             <option value='pub'>Pub</option>
             <option v-if='dhtEnabled' value='dht'>DHT Peer invite</option>
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
          <span v-if="peer.lastUpdate"><small>{{ $t('connections.lastUpdateReceived', { datetime: peer.lastUpdate }) }}</small><br /></span>
        </div>
      </div>
      <button v-if="dhtEnabled" class="clickButton" v-on:click="createInvite">Create invite</button>
      <dht-invite v-if="dhtEnabled" v-bind:show="showInvite" v-bind:inviteCode="inviteCode" v-bind:onClose="closeInvite"></dht-invite>
      <div id="status" v-html="statusHTML"></div>
    </div>`,

    data: function() {
      return {
        type: 'room',
        address: '',

        componentStillLoaded: false,
        statusHTML: '',
        running: true,
        connected: false,
        connectedWithData: false,
        synced: false,
        online: false,
        hasFollowProgress: false,
        followProgress: 0,
        hasExtendedProgress: false,
        extendedProgress: 0,
        suggestedPeers: [],
        stagedPeers: [],
        peers: [],

        inviteCode: '',
        dhtEnabled: false,
        showInvite: false
      }
    },

    methods: {
      onTypeChange: function() {
      },

      goOffline: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't go offline right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        localPrefs.setOfflineMode(true)
        this.online = false
        SSB.net.conn.stop()
      },

      goOnline: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't go online right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        localPrefs.setOfflineMode(false)
        this.online = true
        SSB.net.conn.start()
      },

      onConnected: function() {
        // If we're connected, we're definitely online.
        // Set the preference, too, in case ssb-browser-core is a version which doesn't support offline mode, just to make sure the preference stays in sync with reality.
        [ err, SSB ] = ssbSingleton.getSSB()
        this.online = true
        localPrefs.setOfflineMode(false)
        this.connected = true
        SSB.disconnected(this.onDisconnected)
      },

      onConnectedWithData: function() {
        this.connectedWithData = true
      },

      onDisconnected: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        this.online = false
        this.connected = false
        this.connectedWithData = false
        SSB.connected(this.onConnected)
        SSB.connectedWithData(this.onConnectedWithData)
      },

      add: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't add peers right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        var s = this.address.split(":")
        if (s[0] != 'ws' && s[0] != 'wss' && s[0] != 'dht' && s[0] != 'bt') {
          alert(this.$root.$t('connections.unsupportedConnectionTypeX', { connType: s[0] }))
          return
        }
        if (s[0] == 'dht') {
          SSB.net.dhtInvite.start((err, success) => {
            if (err)
              alert("Unable to accept this invite - could not start the DHT connection system.")
            else
              SSB.net.dhtInvite.accept(this.address, () => {});
          })
        }
        else
          SSB.net.connectAndRemember(this.address, {
            key: '@' + s[s.length-1] + '.ed25519',
            type: this.type
          })
      },
      connectSuggested: function(suggestedPeer) {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't add peers right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

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
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't add peers right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        SSB.net.connectAndRemember(stagedPeer.address, stagedPeer.data)
        this.updateSuggestedPeers()

        // Ask about following.
        if (stagedPeer.data.type == "room-endpoint") {
          var s = stagedPeer.address.split(":")
          var peerId = '@' + s[s.length-1] + '.ed25519'
          var follow = confirm(this.$root.$t('connections.followNewConnection'))
          if (follow) {
            SSB.db.publish({
              type: 'contact',
              contact: peerId,
              following: true
            }, () => {})
          }
        }
      },
      disconnect: function(peer) {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't disconnect peers right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        SSB.net.conn.forget(peer.address)
        SSB.net.conn.disconnect(peer.address)
        this.updateSuggestedPeers()
      },
      createInvite: function() {
        [ err, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.net) {
          alert("Can't create an invite right now.  Couldn't lock database.  Please make sure you're only running one instance of ssb-browser.")
          return
        }

        if(SSB.net.dhtInvite) {
          this.inviteCode = "(Generating invite code...)";
          var connectionsScreen = this;
          SSB.net.dhtInvite.start((err, success) => {
            if (err)
              connectionsScreen.inviteCode = "Sorry.  An invite code could not be generated.  Could not start the DHT connection system.  Please try again.";
            else
              SSB.net.dhtInvite.create((err, inviteCode) => {
                if(err) {
                  connectionsScreen.inviteCode = "Sorry.  An invite code could not be generated.  Please try again.";
                } else {
                  connectionsScreen.inviteCode = inviteCode;
                }
              })
          })
        } else {
          this.inviteCode = "The version of ssb-browser-core you have does not support DHT.  Please upgrade it to the latest version.";
        }

        this.showInvite = true
      },
      closeInvite: function() {
        this.showInvite = false
      },
      renderConnections: function() {
        var self = this
        ssbSingleton.getSSBEventually(-1, () => { return self.componentStillLoaded },
          (SSB) => { return SSB && SSB.net }, self.renderConnectionsCallback)
      },
      renderConnectionsCallback: function(err, SSB) {
        var self = this

        document.title = this.$root.appTitle + " - " + this.$root.$t('connections.title')

        self.onTypeChange()

        this.online = !localPrefs.getOfflineMode()
        this.connected = SSB.isConnected()
        this.connectedWithData = SSB.isConnectedWithData()
        if (this.connected) {
          SSB.disconnected(this.onDisconnected)
        } else {
          SSB.connected(this.onConnected)
          SSB.connectedWithData(this.onConnectedWithData)
        }

        let lastStatus = null
        let lastEbtStatus = null

        /* not working after updating to ssb-ebt 7
        function updatePeerTS() {
          // Last updated timestamp needs to be the maximum value from several sources.
          SSB.net.ebt.peerStatus((err, ebtPeers) => {
            for (p in self.peers) {
              var ts = (self.peers[p].data.hubUpdated || 0)
              ts = Math.max(ts, (self.peers[p].data.stateChange || 0))
              if (ebtPeers[self.peers[p].data.key] && ebtPeers[self.peers[p].data.key].ts)
                ts = Math.max(ts, ebtPeers[self.peers[p].data.key].ts)
              self.peers[p].ts = ts
              self.peers[p].lastUpdate = (new Date(ts)).toLocaleString()
            }
          })
        }
        */

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
            //updatePeerTS()
            self.updateSuggestedPeers()
          })
        )

        function updateSynced() {
          if (!self.running) return

          setTimeout(() => {
            self.synced = self.online && self.connected && self.connectedWithData && self.$root.$refs["connected"].synced

            updateSynced()
          }, 500)
        }

        updateSynced()

        function updateDBStatus() {
          // This is a long-running process, so we need to make sure we're re-acquiring SSB in case the one we've been using goes away (parent window closed, for example).
          [ err, SSB ] = ssbSingleton.getSSB()
          if (!self.running) return
          if (!SSB || !SSB.db || !SSB.net.feedReplication) {
            setTimeout(updateDBStatus, 5000)
            return
          }

          setTimeout(() => {
            const status = Object.assign(SSB.db.getStatus().value, SSB.net.feedReplication.partialStatus())
            const ebtStatus = SSB.net.ebt.peerStatus(SSB.net.id)

            //updatePeerTS()

            if (JSON.stringify(status) == JSON.stringify(lastStatus) &&
                JSON.stringify(ebtStatus) == JSON.stringify(lastEbtStatus)) {
              updateDBStatus()

              return
            }

            lastStatus = Object.assign({}, status)
            lastEbtStatus = Object.assign({}, ebtStatus)

            var html = "<h3>" + self.$root.$t('connections.dbStatus') + "</h3>"
            html += "<pre>" + JSON.stringify(status, null, 2) + "</pre>"
            html += "<h3>" + self.$root.$t('connections.ebtStatus') + "</h3>"
            html += "<pre>" + JSON.stringify(ebtStatus, null, 2) + "</pre>"
            self.statusHTML = html

            self.hasFollowProgress = status.totalFull
            if (status.totalFull) {
              self.followProgress = Math.round((status.fullSynced) * 100 / (status.totalFull))
              if (self.followProgress > 100)
                self.followProgress = 100
              let progressBar = document.getElementById("syncProgressFollow")
              // In case we've navigated away since the timer was set or Vue hasn't updated since we set hasFollowProgress.
              if (progressBar)
                progressBar.style.width = (self.followProgress * 0.99 + 1) + "%"
            }
            self.hasExtendedProgress = status.totalPartial
            if (status.totalPartial) {
              self.extendedProgress = Math.round((status.profilesSynced + status.contactsSynced + status.messagesSynced) * 100 / (status.totalPartial * 3))
              if (self.extendedProgress > 100)
                self.extendedProgress = 100
              let progressBar = document.getElementById("syncProgressExtended")
              // In case we've navigated away since the timer was set or Vue hasn't updated since we set hasExtendedProgress.
              if (progressBar)
                progressBar.style.width = (self.extendedProgress * 0.99 + 1) + "%"
            }

            updateDBStatus()
          }, 1000)
        }

        updateDBStatus()
      }
    },

    created: function() {
      this.componentStillLoaded = true
      this.dhtEnabled = localPrefs.getDHTEnabled()
      this.renderConnections()
    },

    beforeRouteLeave: function(from, to, next) {
      this.running = false
      next()
    },

    destroyed: function() {
      this.componentStillLoaded = false
    },

    watch: {
      stagedPeers: function(oldValue, newValue) {
        [ err, SSB ] = ssbSingleton.getSSB()
        var self = this
        for (x in this.stagedPeers) {
          (function(p) {
            var suggestNamesForPeer = defaultPrefs.suggestPeers.filter((x) => x.address == self.stagedPeers[p].address)
            if (suggestNamesForPeer.length > 0)
              self.stagedPeers[p].name = suggestNamesForPeer[0].name
            else if (self.stagedPeers[p].data && self.stagedPeers[p].data.type == 'room-endpoint') {
              var key = self.stagedPeers[p].data.key
              const name = (SSB && SSB.getProfileName ? SSB.getProfileName(key) : key)
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
        [ err, SSB ] = ssbSingleton.getSSB()
        var self = this
        for (x in this.peers) {
          (function(p) {
            var suggestNamesForPeer = defaultPrefs.suggestPeers.filter((x) => x.address == self.peers[p].address)
            if (suggestNamesForPeer.length > 0)
              self.peers[p].name = suggestNamesForPeer[0].name
            else if (self.peers[p].data && self.peers[p].data.type == 'room-endpoint') {
              var key = self.peers[p].data.key
              const name = (SSB && SSB.getProfileName ? SSB.getProfileName(key) : key)
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
