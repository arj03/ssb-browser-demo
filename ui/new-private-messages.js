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

      return // FIXME

      pull(
        SSB.db.query.read({
          live: true,
          old: false,
          query: [{
            $filter: {
              value: {
                timestamp: { $gt: 0 },
                content: { type: 'post', recps: { $truthy: true } }
              }
            }
          }]
        }),
        pull.drain(() => {
          self.newPrivateMessages = true
        })
      )
    }
  })
}
