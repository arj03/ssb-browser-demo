var SecretStack = require('secret-stack')
var defaultCaps = require('ssb-caps')

// FIXME: manifest merge stuff

exports.init = function(keys, caps, manifest) {
  console.log("raw client keys", keys)
  console.log("raw client caps", caps)

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
