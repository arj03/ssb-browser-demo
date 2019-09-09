var Store = require('./store')

var hash = require('ssb-keys/util').hash

function getId(msg) {
  return '%'+hash(JSON.stringify(msg, null, 2))
}

exports.init = function (dir, ssbId) {
  store = Store(dir, ssbId)

  function get(id, cb) {
    store.keys.get(id, (err, data) => {
      if (data)
	cb(null, data.value)
      else
	cb(err)
    })
  }

  function add(msg, cb) {
    var id = getId(msg)

    if (store.since.value == 0)
    {
      // empty db, keys.get will block, just add anyways
      store.add(id, msg, cb)
    }
    else
    {
      store.keys.get(id, (err, data) => {
	if (data)
	  cb(null, data.value)
	else
	  store.add(id, msg, cb)
      })
    }
  }
  
  return {
    get,
    add,
    // indexes
    //backlinks: store.backlinks,
    query: store.query,
    last: store.last,
    clock: store.clock,
    friends: store.friends,
    getStatus: store.getStatus
  }
}
