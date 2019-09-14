const pull = require('pull-stream')
const pullAbort = require('pull-abortable')

module.exports = function () {
  var abortablePullStream = null
  
  return {
    template: `<div style='margin-bottom: 10px'>Your id: {{ SSB.net.id }} </div>
         <button id="acceptConnections" v-on:click="SSB.net.tunnelChat.acceptMessages">Accept incoming connections</button>   or  
         <input type="text" id="tunnelConnect" v-on:keyup.enter="connect" v-model="remoteId" placeholder="remote feedId to connect to" />
         <input type="text" id="chatMessage" v-model="chatText" v-on:keyup.enter="onChatSend" placeholder="type message, enter to send" />
         <h2>Off-chain messages</h2> 
         <div id="chatDescription">Off-chain messages are messages sent
            encrypted between you and the other end through the magic of
            tunnels. These messages are ephemeral and will be gone forever
            when you change view!</div>
         <div id="messages"></div>`,

    data: function() {
      return {
        remoteId: "",
        chatText: ""
      }
    },
    
    methods: {
      connect: function() {
        SSB.net.tunnelChat.connect(this.remoteId)
      },
      
      onChatSend: function() {
        SSB.net.tunnelChat.sendMessage(this.chatText)
        chatText = ''
      },
      
      renderChat: function() {
        abortablePullStream = pullAbort()
        pull(
          SSB.net.tunnelChat.messages(),
          abortablePullStream,
          pull.drain((msg) => {
            document.getElementById("messages").innerHTML += msg.user + "> " + msg.text + "<br>"
          })
        )
      }
    },

    beforeRouteLeave: function() {
      if (abortablePullStream != null) {
        abortablePullStream.abort()
        abortablePullStream = null
      }
    }
  }
}
