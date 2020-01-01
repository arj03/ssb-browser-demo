var SecretStack = require('secret-stack')
var defaultCaps = require('ssb-caps')

exports.init = function(keys, caps, manifest) {
  if (!caps || !caps.shs)
    caps = { shs: Buffer.from(defaultCaps.shs, 'base64') }

  return SecretStack({
    caps,
    keys,
    connections: {
      outgoing: {
	ws: [{ transform: 'shs' }],
	tunnel: [{ transform: 'shs' }]
      }
    },
    timers: {
      inactivity: 30e3
    }
  })
  .use(require('ssb-ws'))
  .use({ manifest, init: function() {} })
  ()
}
