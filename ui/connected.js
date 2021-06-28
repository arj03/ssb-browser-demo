const ssbSingleton = require('ssb-browser-core/ssb-singleton')

Vue.component('connected', {
  template: `
    <span class="connected-indicator">
      <span v-if="yellowIndicator" class="connected-indicator-not-synced" :title="$t('connected.connectedNotSynced')" style="color: #cc0;">
        <span>&#9673;</span>
      </span><span v-if="greenIndicator" class="connected-indicator-synced" :title="$t('connected.connectedToPeer')" style="color: #090;">
        <span>&#9673;</span>
      </span>
    </span>`,

  data: function() {
    return {
      initializedSSB: false,
      greenIndicator: false,
      yellowIndicator: false,
      connected: false,
      synced: false
    }
  },

  methods: {
    onConnected: function() {
      this.connected = true
      this.updateIndicators()
      SSB.disconnected(this.onDisconnected)
    },

    onDisconnected: function() {
      this.connected = false
      this.updateIndicators()
      SSB.connected(this.onConnected)
    },

    updateIndicators: function() {
      this.greenIndicator = this.connected && this.synced
      this.yellowIndicator = this.connected && !this.synced
    }
  },

  created: function() {
    var self = this

    ssbSingleton.onChangeSSB(function() {
      self.initializedSSB = false
    })
    setInterval(function() {
      [ err, SSB ] = ssbSingleton.getSSB()
      if (SSB && SSB.net.feedReplication) {
        if (!self.initializedSSB) {
          self.initializedSSB = true
          self.onDisconnected()
        }
        self.synced = SSB.net.feedReplication.inSync()
      }

      self.updateIndicators()
    }, 1000)
  }
})
