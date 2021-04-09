module.exports = function (state) {
  const pull = require('pull-stream')  
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  Vue.component('new-private-messages', {
    template: `
        <span v-if="newPrivateMessages" class="newPrivate" title="New messages" v-on:click="reset">
          <span>&#128274;</span>
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
      },

      tryLoading: function () {
        var self = this;
  
        [ err, SSB ] = ssbSingleton.getSSB()
        if (err || !SSB.db) {
          setTimeout(self.tryLoading, 3000)
          return
        }
  
        // This should only be done once, and only after we've already gotten an SSB running, which is why it's done here.
        if (!self.registeredSSBChange) {
          ssbSingleton.onChangeSSB(self.tryLoading)
          self.registeredSSBChange = true
        }
  
        const { where, isPrivate, type, live, toPullStream } = SSB.dbOperators

        pull(
          SSB.db.query(
            where(isPrivate()),
            live(),
            toPullStream(),
            pull.drain(() => {
              self.newPrivateMessages = true
            })
          )
        )
      }
    },

    created: function() {
      this.tryLoading()
    }
  })
}
