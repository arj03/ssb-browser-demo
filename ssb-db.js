// name is blank as in ssb-db to merge into global namespace
// most of this stuff is from ssb-db

const validate = require('ssb-validate')
const keys = require('ssb-keys')
const pull = require('pull-stream')
var Obv = require('obv')

exports.manifest =  {
  createHistoryStream: 'source',
  partialReplication: {
    partialReplication: 'source',
    partialReplicationReverse: 'source',
  }
}

exports.permissions = {
  anonymous: {allow: ['createHistoryStream'], deny: null}
}

exports.init = function (sbot, config) {
  // ebt stuff

  sbot.createHistoryStream = function() {
    return pull.empty()
  }

  sbot.post = Obv()

  sbot.getVectorClock = function (_, cb) {
    if (!cb) cb = _

    function getClock()
    {
      var last = SSB.db.last.get()
      var clock = {}
      for (var k in last) {
        clock[k] = last[k].sequence
      }
      cb(null, clock)
    }

    SSB.events.on('SSB: loaded', getClock)
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

  function updateProfile(msg) {
    if (!SSB.profiles)
      SSB.profiles = {}
    if (!SSB.profiles[msg.author])
      SSB.profiles[msg.author] = {}

    if (msg.content.name)
      SSB.profiles[msg.author].name = msg.content.name
    if (msg.content.description)
      SSB.profiles[msg.author].description = msg.content.description

    if (msg.content.image && typeof msg.content.image.link === 'string')
      SSB.profiles[msg.author].image = msg.content.image.link
    else if (typeof msg.content.image === 'string')
      SSB.profiles[msg.author].image = msg.content.image
  }

  sbot.add = function(msg, cb) {
    if (!(msg.author in SSB.state.feeds))
      SSB.state = validate.appendOOO(SSB.state, hmac_key, msg)
    else
      SSB.state = validate.append(SSB.state, hmac_key, msg)

    if (SSB.state.error)
      return cb(SSB.state.error)

    var last = SSB.db.last.update(msg)

    var ok = true

    if (last.partial) {
      var isPrivate = (typeof (msg.content) === 'string')

      if (isPrivate && !SSB.privateMessages) {
        ok = false
      } else if (!isPrivate && msg.content.type == 'about' && msg.content.about == msg.author) {
        updateProfile(msg)
      } else if (!isPrivate && !SSB.validMessageTypes.includes(msg.content.type)) {
        ok = false
      } else if (isPrivate) {
        var decrypted = decryptMessage(msg)
        if (!decrypted) // not for us
          ok = false
      }
    }
    else if (msg.content.type == 'about' && msg.content.about == msg.author)
      updateProfile(msg)

    if (ok)
      SSB.db.add(msg, cb)
    else {
      SSB.db.last.setPartialLogState(msg.author, true)
      cb()
    }
  }

  return {}
}
