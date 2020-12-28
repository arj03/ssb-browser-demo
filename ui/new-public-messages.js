module.exports = function (state) {
  const { and, type, live, toPullStream } = require('ssb-db2/operators')  
  const pull = require('pull-stream')  

  var loaded = false

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

      if (loaded) return // is loaded twice?
      loaded = true

      pull(
        SSB.db.query(
          and(type('post')),
          live(),
          toPullStream(),
          pull.drain((msg) => {
            if (!msg.value.meta)
              self.newPublicMessages = true
          })
        )
      )
    }
  })
}
