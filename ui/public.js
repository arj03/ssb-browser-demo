module.exports = function () {
  const pull = require('pull-stream')

  return {
    template: `<div id="public">
        <textarea class="messageText" v-if="postMessageVisible" v-model="postText"></textarea>
        <br>
        <button id="postMessage" v-on:click="onPost">Post new thread</button>
        <input type="file" id="publicMessageFileInput" v-if="postMessageVisible" v-on:change="onFileSelect">
        <h2>Last 50 messages</h2>
        Threads only: <input id='onlyThreads' type='checkbox' v-model="onlyThreads">
        <br>
        <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
    </div>`,

    data: function() {
      return {
        postMessageVisible: false,
        postText: "",
        onlyThreads: false,
        messages: []
      }
    },

    methods: {
      renderPublic: function () {
        let contentFilter = { type: 'post' }
        if (this.onlyThreads)
          contentFilter["root"] = undefined

        pull(
          SSB.db.query.read({
            reverse: true,
            limit: 50,
            query: [{
              $filter: {
                value: {
                  timestamp: { $gt: 0 },
                  //author: '@VIOn+8a/vaQvv/Ew3+KriCngyUXHxHbjXkj4GafBAY0=.ed25519'
                  content: contentFilter
                }
              }
            }]
          }),
          pull.filter((msg) => !msg.value.meta),
          pull.collect((err, msgs) => {
            this.messages = msgs
          })
        )
      },

      onFileSelect: function(ev) {
        const file = ev.target.files[0]

        if (!file) return

        var self = this

        file.arrayBuffer().then(function (buffer) {
          SSB.net.blobs.hash(new Uint8Array(buffer), (err, digest) => {
            SSB.net.blobs.add("&" + digest, file, (err) => {
              if (!err) {
                SSB.net.blobs.push("&" + digest, (err) => {
                  self.postText += " ![" + file.name + "](&" + digest + ")"
                })
              }
            })
          })
        })
      },
      
      onPost: function() {
        if (!this.postMessageVisible) {
          this.postMessageVisible = true
          return
        }

        if (this.postText != '') {
          var self = this
          SSB.publish({ type: 'post', text: this.postText }, (err) => {
            if (err) console.log(err)

            self.postText = ""
            
            this.renderPublic()
          })
        }
      }
    },

    created: function () {
      this.renderPublic()
    },
    
    watch: {
      onlyThreads: function (newValue, oldValue) {
        this.renderPublic()
      }
    }
  }
}
