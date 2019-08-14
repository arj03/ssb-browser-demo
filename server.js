var SecretStack = require('secret-stack')
var caps = require('ssb-caps')
var ssbKeys = require('ssb-keys')

var path = require('path')

exports.init = function(dir) {
  var keys = ssbKeys.loadOrCreateSync(path.join(dir, 'secret'))

  var r = SecretStack({
    caps: { shs: Buffer.from(caps.shs, 'base64') },
    keys,
    connections: {
      incoming: {
	tunnel: [{ transform: 'shs' }]
      },
      outgoing: {
	net: [{ transform: 'shs' }],
	onion: [{ transform: 'shs' }],
	ws: [{ transform: 'shs' }, { transform: 'noauth' }],
	tunnel: [{ transform: 'shs' }]
      }
    },
    path: dir,
    timers: {
      inactivity: 30e3
    },
    tunnel: {
      logging: true
    }
  })
  .use(require('./ssb-db'))
  .use(require('./ssb-get-thread'))
  .use(require('./simple-ooo'))
  .use(require('ssb-onion'))
  .use(require('ssb-no-auth'))
  .use(require('ssb-ws'))
  .use(require('ssb-ebt'))
  .use(require('ssb-tunnel'))
  .use(require('./tunnel-chat'))
  //.use(require('ssb-blobs'))
  ()

  r.blobs = require("./simple-blobs")(dir)

  var timer

  r.on('rpc:connect', function (rpc, isClient) {
    console.log("connected to:", rpc.id)

    function ping() {
      rpc.tunnel.ping(function (err, _ts) {
	if (err) return console.error(err)
	clearTimeout(timer)
	timer = setTimeout(ping, 10e3)
      })
    }

    ping()
  })

  r.on('rpc:disconnect', function (rpc, isClient) {
    console.log("disconnected from:", rpc.id)

    clearTimeout(timer)
  })

  r.on('replicate:finish', function () {
    console.log("finished ebt replicate")
  })

  r.gossip = {
    connect: function(addr, cb) {
      // hack for ssb-tunnel
      r.connect(SSB.remoteAddress, cb)
    }
  }

  return r
}
