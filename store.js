var Flume = require('flumedb')
var OffsetLog = require('flumelog-aligned-offset')
var OffsetLogCompat = require('flumelog-aligned-offset/compat')
var codec = require('flumecodec/json')
var keys = require('ssb-keys')
var path = require('path')

module.exports = function (dir, ssbId) {
  console.log("dir:", dir)

  var log = OffsetLogCompat(OffsetLog(
    path.join(dir, 'log.offset'),
    {blockSize:1024*64, codec:codec}
  ))

  var config = {}

  var store = Flume(log, true, (msg, cb) => {
    if (msg && msg.value && typeof (msg.value.content) === 'string') {
      var decrypted = keys.unbox(msg.value.content, SSB.net.config.keys.private)
      if (!decrypted) // not for us
        return cb(null, msg)

      var cyphertext = msg.value.content

      msg.value.content = decrypted
      msg.value.meta = {
	private: true,
	original: {
	  content: cyphertext
	}
      }

      cb(null, msg)
    } else
      cb(null, msg)
  })
    .use('keys', require('./indexes/keys')())
    .use('clock', require('./indexes/clock')())

  store.last = require('./indexes/last')()

  store.del = (key, cb) => {
    store.keys.get(key, (err, val, seq) => {
      if (err) return cb(err)
      if (seq == null) return cb(new Error('seq is null!'))

      log.del(seq, cb)
    })
  }

  // ssb-db convention used by plugins
  store._flumeUse = function (name, flumeview) {
    store.use(name, flumeview)
    return store[name]
  }
  store.id = ssbId

  /*
  var backlinks = require('ssb-backlinks')
  store.backlinks = backlinks.init(store)
  */

  var friends = require('ssb-friends')
  store.friends = friends.init(store, config)

  // depends on friends plugin
  var peerInvites = require('ssb-peer-invites')
  peerInvites.init(store, config)

  var query = require('ssb-query')
  store.query = query.init(store)

  store.getStatus = function() {
    // taken from ssb-db:
    // https://github.com/ssbc/ssb-db/blob/80af97584f7700661a63fa6065885641911443ae/index.js#L66

    function isObject(o) { return 'object' === typeof o }
    function isFunction (f) { return 'function' === typeof f }

    var plugs = {}
    var sync = true
    for(var k in store) {
      if(store[k] && isObject(store[k]) && isFunction(store[k].since)) {
        plugs[k] = store[k].since.value
        sync = sync && (plugs[k] === store.since.value)
      }
    }

    return {
      since: store.since.value,
      plugins: plugs,
      sync: sync,
    }
  }

  store.add = function (id, msg, cb) {
    var data = {
      key: id,
      value: msg,
      timestamp: Date.now()
    }
    store.append(data, function (err) {
      if(err) cb(err)
      else cb(null, data)
    })
  }

  return store
}
