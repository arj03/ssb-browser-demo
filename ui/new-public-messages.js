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

      const query = {
        type: 'EQUAL',
        data: {
          seek: SSB.db.jitdb.seekType,
          value: 'post',
          indexType: "type"
        }
      }

      SSB.db.jitdb.onReady(() => {
        SSB.db.jitdb.liveQuerySingleIndex(query, (err, results) => {
          if (results.some(msg => !msg.value.meta))
            self.newPublicMessages = true
        })
      })
    }
  })
}
