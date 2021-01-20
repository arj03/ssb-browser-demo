Vue.component('connected', {
  template: `
  <span v-if="connected" :title="{{ $t('connected.connectedToPeer') }}" style="color: #090;">
    &#9673;
  </span>`,

  data: function() {
    return {
      connected: false,
      numConnections: 0
    }
  },

  created: function() {
    var self = this
    SSB.net.on('rpc:connect', (rpc) => {
      ++self.numConnections
      self.connected = true
      rpc.on('closed', () => self.connected = (--(self.numConnections) > 0))
    })
  }
})
