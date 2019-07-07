var pull = require('pull-stream')
var GQ = require('gossip-query')
var hash = require('ssb-keys/util').hash
var isMsg = require('ssb-ref').isMsg

var Store = require('./store')

function getId(msg) {
  return '%'+hash(JSON.stringify(msg, null, 2))
}

function isObject (o) {
  return o && 'object' === typeof o
}

exports.init = function (path) {
  store = Store(path)

  function get(id, cb) {
    store.keys.get(id, function (err, data) {
      if (data)
	cb(null, data.value)
      else
	cb(err)
    })
  }

  function put(msg, cb) {
    store.add(msg, cb)
  }
  
  return {
    get: get,
    put: put
  }
}
