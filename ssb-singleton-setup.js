const localPrefs = require('./localprefs')
const pull = require('pull-stream')

const config = {
  caps: { shs: Buffer.from(localPrefs.getCaps(), 'base64') },
  friends: {
    hops: localPrefs.getHops(),
    hookReplicate: false
  },
  connections: (localPrefs.getDHTEnabled() ? {
      incoming: {
        tunnel: [{ scope: 'public', transform: 'shs' }],
        dht: [{ scope: 'public', transform: 'shs' }]
      },
      outgoing: {
        net: [{ transform: 'shs' }],
        ws: [{ transform: 'shs' }, { transform: 'noauth' }],
        tunnel: [{ transform: 'shs' }],
        dht: [{ transform: 'shs' }]
      }
    } : {
      incoming: {
        tunnel: [{ scope: 'public', transform: 'shs' }]
      },
      outgoing: {
        net: [{ transform: 'shs' }],
        ws: [{ transform: 'shs' }, { transform: 'noauth' }],
        tunnel: [{ transform: 'shs' }]
      }
    }
  ),
  hops: localPrefs.getHops(),
  core: {
    startOffline: localPrefs.getOfflineMode()
  },
  ebt: {
    logging: localPrefs.getDetailedLogging()
  },
  conn: {
    autostart: false,
    hops: localPrefs.getHops(),
    populatePubs: false
  }
}

function extraModules(secretStack) {
  return secretStack.use({
    init: function (sbot, config) {
      sbot.db.registerIndex(require('ssb-db2/indexes/full-mentions'))
    }
  })
  .use({
    init: function (sbot, config) {
      sbot.db.registerIndex(require('ssb-db2/indexes/about-self'))
    }
  })
  .use({
    init: function (sbot, config) {
      sbot.db.registerIndex(require('./indexes/channels'))
    }
  })
  .use(require("ssb-threads"))
}

function ssbLoaded() {
  // add helper methods
  SSB = window.singletonSSB
  require('./net')
  require('./profile')
  require('./search')

  pull(SSB.net.conn.hub().listen(), pull.drain((ev) => {
    if (ev.type.indexOf("failed") >= 0)
      console.warn("Connection error: ", ev)
  }))
}

require('ssb-browser-core/ssb-singleton').init(config, extraModules, ssbLoaded)
