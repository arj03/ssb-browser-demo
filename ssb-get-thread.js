exports.manifest = {
  get: 'async'
}

exports.name = 'get-thread'

exports.permissions = {
  anonymous: { allow: ['get'] }
}

exports.init = function (sbot, config) {
  return {
    get: function(msgId, cb) {
      // FIXME
    }
  }
}

