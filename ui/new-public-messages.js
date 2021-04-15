module.exports = function (state) {
  const pull = require('pull-stream')  
  const localPrefs = require('../localprefs')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  Vue.component('new-public-messages', {
    template: `
        <span v-if="newPublicMessages" class="newPublic" title="New messages" v-on:click="reset">
          <span>&#127881;</span>
        </span>`,

    data: function() {
      return state
    },

    methods: {
      refreshIfConfigured() {
        const scrollTop = (typeof document.body.scrollTop != 'undefined' ? document.body.scrollTop : window.scrollY)
        if (this.newPublicMessages && scrollTop == 0 && this.$route.path == "/public" && localPrefs.getAutorefresh()) {
          this.$route.matched[0].instances.default.refresh()
        }
        if (this.newPublicMessages && scrollTop == 0 && this.$route.path == "/threads" && localPrefs.getAutorefresh()) {
          this.$route.matched[0].instances.default.refresh()
        }
      },

      reset() {
        // render public resets the newPublicMessages state
        if (this.$route.path == "/public")
          this.$route.matched[0].instances.default.refresh()
        else
          this.$router.push({ path: '/public'})
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
  
        const { where, and, type, isPublic, live, toPullStream } = SSB.dbOperators
  
        pull(
          SSB.db.query(
            where(
              and(
                type('post'),
                isPublic()
              )
            ),
            live(),
            toPullStream(),
            pull.drain((msg) => {
              if (!msg.value.meta) {
                self.newPublicMessages = true
  
                // If we're scrolled to the top of the page and autorefresh is on, refresh.
                if (self.publicRefreshTimer == 0 && localPrefs.getAutorefresh()) {
                  // Only allow refreshing every 30 seconds, but at the end of that, check once again if we have queued messages.
                  self.publicRefreshTimer = setTimeout(function() {
                    console.log("Checking for new data via timer...")
                    self.refreshIfConfigured()
  
                    // After another few seconds, clear the blocking timer.
                    self.publicRefreshTimer = 0
                    console.log("Autorefresh blocking timer cleared.  Autorefreshing is allowed to proceed.")
                  }, 30000)
  
                  // Refresh now.
                  console.log("Autorefreshing blocked for 30 seconds.  Refreshing via event...")
                  self.refreshIfConfigured()
                }
              }
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
