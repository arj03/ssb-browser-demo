exports.name = 'gossip'
exports.manifest = {
  ping: 'duplex',
  connect: 'async'
}
exports.permissions = {
  anonymous: {allow: ['ping']}
}

exports.init = function (sbot, config) {
  return {
    connect: function(addr, cb) {
      // hack for ssb-tunnel
      sbot.connect(SSB.remoteAddress, cb)
    },
    ping: function() {
      var timeout = config.timers && config.timers.ping || 5*60e3
      //between 10 seconds and 30 minutes, default 5 min
      timeout = Math.max(10e3, Math.min(timeout, 30*60e3))
      return ping({timeout})
    }
  }
}
  
