module.exports = function (state) {
  var loaded = false

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

      if (loaded) return // is loaded twice?
      loaded = true

      const query = {
        type: 'EQUAL',
        data: {
          seek: SSB.db.jitdb.seekPrivate,
          value: "true",
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
