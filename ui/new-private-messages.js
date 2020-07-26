module.exports = function (state) {
  const pull = require('pull-stream')

  Vue.component('new-private-messages', {
    template: `
        <span v-if="newPrivateMessages" class="newPrivate" title="New messages" v-on:click="reset">
          &#128274;
        </span>`,

    data: function() {
      return state
    },

    methods: {
      reset() {
        if (this.$route.path == "/private")
          this.$route.matched[0].instances.default.renderPrivate()
        else
          this.$router.push({ path: '/private'})
      }
    },

    created: function () {
      var self = this

      const query = {
        type: 'EQUAL',
        data: {
          seek: SSB.db.jitdb.seekPrivate,
          value: Buffer.from("true"),
          indexType: "private"
        }
      }

      SSB.db.jitdb.onReady(() => {
        SSB.db.jitdb.liveQuerySingleIndex(query, (err, results) => {
          self.newPrivateMessages = true
        })
      })
    }
  })
}
