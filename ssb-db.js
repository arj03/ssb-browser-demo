// name is blank as in ssb-db to merge into global namespace
// most of this stuff is from ssb-db

const validate = require('ssb-validate')
const keys = require('ssb-keys')
const pull = require('pull-stream')

exports.manifest =  {
  createHistoryStream: 'source'
}

exports.permissions = {
  anonymous: {allow: ['createHistoryStream'], deny: null}
}

exports.init = function (sbot, config) {
  // ebt stuff

  sbot.createHistoryStream = function() {
    return pull.empty()
  }

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

  function decryptMessage(msg) {
    return keys.unbox(msg.content, SSB.net.config.keys.private)
  }

  const hmac_key = null

  sbot.add = function(msg, cb) {
    if (!(msg.author in SSB.state.feeds))
      SSB.state = validate.appendOOO(SSB.state, hmac_key, msg)
    else
      SSB.state = validate.append(SSB.state, hmac_key, msg)

    if (SSB.state.error)
      return cb(SSB.state.error)

    SSB.db.last.update(msg)

    var isPrivate = (typeof (msg.content) === 'string')

    if (isPrivate && !SSB.privateMessages)
      return cb()
    else if (!isPrivate && !SSB.validMessageTypes.includes(msg.content.type))
      return cb()

    if (isPrivate)
    {
      var decrypted = decryptMessage(msg)
      if (!decrypted) // not for us
        return cb()
    }

    SSB.db.add(msg, cb)
  }

  return {}
}
