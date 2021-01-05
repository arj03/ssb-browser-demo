module.exports = function (state) {
  const { and, isPrivate, type, live, toPullStream } = SSB.dbOperators
  const pull = require('pull-stream')  

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

      pull(
        SSB.db.query(
          and(isPrivate()),
          live(),
          toPullStream(),
          pull.drain(() => {
            self.newPrivateMessages = true
          })
        )
      )
    }
  })
}
