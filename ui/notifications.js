module.exports = function () {
  const pull = require('pull-stream')
  const asyncFilter = require('pull-async-filter')
  const cat = require('pull-cat')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  return {
    template: `
       <div id="channel">
         <h2>{{ $t('notifications.title') }}</h2>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        componentStillLoaded: false,
        messages: []
      }
    },

    methods: {
      createGetSameRoot: function(SSB) {
        const { where, and, author, type, toCallback, hasRoot } = SSB.dbOperators
  
        return function(read) {
          return function readable (end, cb) {
            read(end, function(end, data) {
              if (data) {
                const root = data.value.content.root ? data.value.content.root : data.key
                // Get all messages with the same root, but only the ones after the user's most recent post.
                SSB.db.query(
                  where(
                    and(
                      hasRoot(root),
                      type('post')
                    )
                  ),
                  toCallback((err, results) => {
                    // Look through the results from the end backwards and look for a post from the user.
                    // If we find one, stop passing along results, so we only have the posts since the user last replied.
                    for (var r = results.length - 1; r >= 0; --r) {
                      if (results[r].value.author == SSB.net.id) break
  
                      cb(false, results[r])
                    }
                  })
                )
              }
              
              // Place the original message back in the queue.
              cb(end, data)
            })
          }
        }
      },

      render: function () {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.renderCB)
      },

      renderCB: function (err, SSB) {
        const { where, and, mentions, contact, author, type, toCallback,
                toPullStream, hasRoot, paginate, descending } = SSB.dbOperators

        var self = this

        console.time("notifications")

        pull(
          cat([
            // Messages directly mentioning the user.
            pull(
              SSB.db.query(
                where(mentions(SSB.net.id)),
                descending(),
                paginate(25),
                toPullStream()
              ),
              pull.take(1),
              pull.flatten()
            ),
            // Messages the user has posted.
            pull(
              SSB.db.query(
                where(
                  and(
                    author(SSB.net.id),
                    type('post')
                  )
                ),
                descending(),
                paginate(25),
                toPullStream()
              ),
              pull.take(1),
              pull.flatten()
            ),
            pull(
              SSB.db.query(
                where(contact(SSB.net.id)),
                descending(),
                paginate(25),
                toPullStream()
              ),
              pull.take(1),
              pull.flatten()
            )
          ]),
          self.createGetSameRoot(SSB),
          pull.unique('key'),
          asyncFilter((msg, cb) => {
            if (msg.value.author === SSB.net.id) return cb(null, true)
            else SSB.net.friends.isBlocking({source: SSB.net.id, dest: msg.value.author }, cb)
          }),
          pull.collect((err, msgs) => {
            console.timeEnd("notifications")
            this.messages = msgs.sort((a, b) => b.value.timestamp - a.value.timestamp).slice(0, 50)
          })
        )
      }
    },

    created: function () {
      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('notifications.title')

      this.render()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    }
  }
}
