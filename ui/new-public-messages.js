const pull = require('pull-stream')

Vue.component('new-public-messages', {
  template: `
        <span v-if="isActive" class="newPublic" title="New messages" v-on:click="reset">
          &#127881;
        </span>`,

  data: function() {
    return {
      isActive : false
    }
  },

  methods: {
    reset() {
      this.isActive = false
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
        self.isActive = true
      })
    )
  }
})
