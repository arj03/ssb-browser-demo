Vue.component('connected', {
  template: `
  <span v-if="connected" title="Connected to remote peer" style="color: #090;">
    &#9673;
  </span>`,

  data: function() {
    return {
      connected: false
    }
  },

  created: function() {
    var self = this
    SSB.net.on('rpc:connect', (rpc) => {
      self.connected = true
      rpc.on('closed', () => self.connected = false)
    })
  }
})
