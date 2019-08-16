const Notify = require('pull-notify');

exports.manifest =  {
  tunnelMessage: 'async'
}

exports.permissions = {
  anonymous: {allow: ['tunnelMessage']}
}

exports.name = 'tunnelChat'

exports.init = function (sbot, config) {

  var messages = Notify()
  var remote

  sbot.on('rpc:connect', function (rpc, isClient) {
    if (!isClient)
      remote = rpc
  })
  
  return {
    acceptMessages: function() {
      SSB.net.tunnel.setupIsConnectionOkHandler((remoteId) => {
	let isOk = confirm("Allow connection from: " + remoteId + "?")
	if (isOk)
	  messages({user: '', text: remoteId + " connected!"})
	return isOk
      })

      SSB.net.connect(SSB.remoteAddress, (err, rpc) => {
	if (err) throw(err)

	rpc.tunnel.announce()
      })
    },
    connect: function(remoteId) {
      var remoteKey = remoteId.substring(1, remoteId.indexOf('.'))
      messages({user: '', text: "waiting for @" + remoteKey + ".ed25519 to accept"})
      SSB.net.connect('tunnel:@'+SSB.remoteAddress.split(':')[3]+ ':' + remoteId + '~shs:' + remoteKey, (err, rpc) => {
	if (err) throw(err)

	remote = rpc
	messages({user: '', text: rpc.id + " connected!"})
      })
    },
    sendMessage: function(text) {
      try {
	remote.tunnelChat.tunnelMessage(text)
	messages({user: 'me', text})
      } catch (e) {
	messages({user: '', text: 'remote end disconnected'})
      }
    },
    tunnelMessage: function(text) {
      messages({user: 'remote', text})
    },
    messages: function() {
      return messages.listen()
    }
  }
}
