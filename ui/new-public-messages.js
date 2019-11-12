module.exports = function (state) {
  const pull = require('pull-stream')
  const throttle = require('lodash.throttle')

  Vue.component('new-public-messages', {
    template: `
        <span v-if="newPublicMessages" class="newPublic" title="New messages" v-on:click="reset">
          &#127881;
        </span>`,

    data: function() {
      return state
    },

    methods: {
      reset() {
        // render public resets the newPublicMessages state
        if (this.$route.path == "/public")
          this.$route.matched[0].instances.default.renderPublic()
        else
          this.$router.push({ path: '/public'})
      }
    },

    created: function () {
      var self = this

      pull(
        SSB.db.query.read({
          live: true,
          old: false,
          query: [{
            $filter: {
              value: {
                timestamp: { $gt: 0 },
                content: { type: 'post' }
              }
            }
          }]
        }),
        pull.filter((msg) => !msg.value.meta),
        pull.drain(() => {
          self.newPublicMessages = true
        })
      )
    }
  })
}
