// this is ripped from ssb-ooo

var pull = require('pull-stream')
var GQ = require('gossip-query')
var hash = require('ssb-keys/util').hash
var isMsg = require('ssb-ref').isMsg
var checkInvalidOOO = require('ssb-validate').checkInvalidOOO

function getId(msg) {
  return '%'+hash(JSON.stringify(msg, null, 2))
}

function isObject (o) {
  return o && 'object' === typeof o
}

exports.name = 'ooo'
exports.version = '1.0.0'
exports.manifest = {
  stream: 'duplex',
  get: 'async',
  help: 'sync'
}
exports.permissions = {
  anonymous: {allow: ['stream']}
}

exports.init = function (sbot, config) {
  var id = sbot.id

  var conf = config.ooo || {}

  var gq = GQ({
    isQuery: isMsg,
    isRequest: function (n) {
      return Number.isInteger(n) && n < 0
    },
    isResponse: function (o) {
      return o && isObject(o)
    },
    check: function (key, cb) {
      SSB.db.get(key, cb)
    },
    isUpdate: function (id, msg, value) {
      return value == null && getId(msg) == id
    },
    process: function (id, msg, cb) {
      if(id !== getId(msg) || checkInvalidOOO(msg, null))
        cb()
      else cb(null, msg)
    },
    timeout: conf.timeout || 30e3
  })

  function get (opts, cb) {
    var id = isMsg(opts) ? opts : opts.id
    var timeout = opts.timeout != null ? opts.timeout : conf.timeout == null ? 5000 : conf.timeout
    var timer
    if(timeout > 0)
      timer = setTimeout(function () {
        var _cb = cb
        cb = null
        _cb(new Error('ooo.get: took more than timeout:'+timeout))
      }, timeout)

    console.log("doing a query for", id)
    
    gq.query(id, function (err, msg) {
      if(err) return cb(err)
      clearTimeout(timer)
      cb && cb(null, msg)
    })
  }

  sbot.on('rpc:connect', function (rpc, isClient) {
    if(isClient) {
      var stream = gq.createStream(rpc.id)
      pull(stream, rpc.ooo.stream(function () {}), stream)
    }
  })

  return {
    stream: function () {
      //called by muxrpc, so remote id is set as this.id
      return gq.createStream(this.id)
    },
    get: get
  }
}
