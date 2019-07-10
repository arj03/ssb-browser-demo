var Store = require('./store')

var hash = require('ssb-keys/util').hash

function getId(msg) {
  return '%'+hash(JSON.stringify(msg, null, 2))
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

  function add(msg, cb) {
    var id = getId(msg)
    store.keys.get(id, function (err, data) {
      if (data)
	cb(null, data.value)
      else
	store.add(id, msg, cb)
    })
  }
  
  return {
    get,
    add
  }
}
