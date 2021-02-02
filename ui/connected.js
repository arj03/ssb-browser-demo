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
    setInterval(function() {
      self.synced = SSB.feedSyncer && SSB.feedSyncer.inSync()
      self.updateIndicators()
    }, 1000)
    this.onDisconnected()
  }
})
