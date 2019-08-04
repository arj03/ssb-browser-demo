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
      outgoing: {
	net: [{ transform: 'shs' }],
	onion: [{ transform: 'shs' }],
	ws: [{ transform: 'shs' }, { transform: 'noauth' }],
      }
    },
    path: dir,
    timers: {
      inactivity: 30e3
    }
  })
  .use(require('./ssb-db'))
  .use(require('./ssb-get-thread'))
  .use(require('./simple-ooo'))
  .use(require('ssb-onion'))
  .use(require('ssb-no-auth'))
  .use(require('ssb-ws'))
  .use(require('ssb-ebt'))
  //.use(require('ssb-blobs'))
  ()

  r.blobs = require("./simple-blobs")(dir)

  r.on('rpc:connect', function (rpc, isClient) {
    console.log("connected to:", rpc.id)
  })

  r.on('rpc:disconnect', function (rpc, isClient) {
    console.log("disconnected from:", rpc.id)
  })

  r.on('replicate:finish', function () {
    console.log("finished ebt replicate")
  })
  
  return r
}
