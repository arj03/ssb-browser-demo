// name is blank as in ssb-db to merge into global namespace
// most of this stuff is from ssb-db

exports.manifest =  {
  createHistoryStream: 'source'
}

exports.permissions = {
  anonymous: {allow: ['createHistoryStream'], deny: null}
}

exports.init = function (sbot, config) {
  sbot.getVectorClock = function (_, cb) {
    if (!cb) cb = _

    function getClock()
    {
      SSB.db.last.get(function (err, h) {
	if (err) return cb(err)
	var clock = {}
	for (var k in h) { clock[k] = h[k].sequence }
	cb(null, clock)
      })
    }

    // yay
    if (typeof(SSB) === 'undefined')
      setTimeout(getClock, 1000)
  }

  function isString (s) {
    return typeof s === 'string'
  }

  function originalValue(value) {
    var copy = {}

    for (let key in value) {
      if (key !== 'meta' && key !== 'cyphertext' && key !== 'private' && key !== 'unbox') {
	copy[key] = value[key]
      }
    }

    if (value.meta && value.meta.original) {
      for (let key in value.meta.original) {
	copy[key] = value.meta.original[key]
      }
    }

    return copy
  }

  function originalData(data) {
    data.value = originalValue(data.value)
    return data
  }

  sbot.getAtSequence = function (seqid, cb) {
    // will NOT expose private plaintext
    SSB.db.clock.get(isString(seqid) ? seqid.split(':') : seqid, function (err, value) {
      if (err) cb(err)
      else cb(null, originalData(value))
    })
  }

  return {}
}
