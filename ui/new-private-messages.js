const pull = require('pull-stream')

Vue.component('new-private-messages', {
  template: `
        <span v-if="isActive" class="newPrivate" title="New messages" v-on:click="reset">
          &#128274;
        </span>`,

  data: function() {
    return {
      isActive : false
    }
  },

  methods: {
    reset() {
      this.isActive = false
      if (this.$route.path == "/private")
        this.$route.matched[0].instances.default.renderPrivate()
      else
        this.$router.push({ path: '/private'})
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
              content: { type: 'post', recps: { $truthy: true } }
            }
          }
        }]
      }),
      pull.drain(() => {
        self.isActive = true
      })
    )
  }
})
