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
        const { where, and, author, type, toCallback, hasRoot } = SSB.db.operators
  
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
                      if (results[r].value.author == SSB.id) break
  
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
                toPullStream, hasRoot, paginate, descending } = SSB.db.operators

        var self = this

        console.time("notifications")

        pull(
          cat([
            // Messages directly mentioning the user.
            pull(
              SSB.db.query(
                where(mentions(SSB.id)),
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
                    author(SSB.id),
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
                where(contact(SSB.id)),
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
            if (msg.value.author === SSB.id) return cb(null, true)
            else SSB.friends.isBlocking({source: SSB.id, dest: msg.value.author }, cb)
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
