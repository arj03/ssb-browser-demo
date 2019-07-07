var Store = require('./store')

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
