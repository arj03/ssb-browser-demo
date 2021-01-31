module.exports = function () {
  const pull = require('pull-stream')
  const cat = require('pull-cat')

  const { and, mentions, author, type, toCallback, toPullStream, hasRoot, paginate, descending } = SSB.dbOperators
  
  return {
    template: `
       <div id="channel">
         <h2>{{ $t('notifications.title') }}</h2>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg" v-bind:thread="msg.value.content.root ? msg.value.content.root : msg.key"></ssb-msg>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        messages: []
      }
    },

    methods: {
      getSameRoot: function(read) {
        return function readable (end, cb) {
          read(end, function(end, data) {
            if (data) {
              const root = data.value.content.root ? data.value.content.root : data.key
              // Get all messages with the same root, but only the ones after the user's most recent post.
              SSB.db.query(
                and(hasRoot(root), type('post')),
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
      },

      render: function () {
        var self = this

        const contacts = SSB.net.db.getIndex('contacts')

        console.time("notifications")

        pull(
          cat([
            // Messages directly mentioning the user.
            pull(
              SSB.db.query(
                and(mentions(SSB.net.id)),
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
                and(author(SSB.net.id), type('post')),
                descending(),
                paginate(25),
                toPullStream()
              ),
              pull.take(1),
              pull.flatten()
            )
          ]),
          self.getSameRoot,
          pull.unique('key'),
          pull.filter((msg) => {
            // Exclude messages from user and blocked authors.
            return (msg.value.author != SSB.net.id) && !(contacts.isBlocking(SSB.net.id, msg.value.author))
          }),
          pull.collect((err, msgs) => {
            // Only show the most recent 50.
            console.timeEnd("notifications")
            this.messages = msgs.sort((a, b) => { if (a.timestamp < b.timestamp) { return 1 } else if (a.timestamp > b.timestamp) { return -1 } else { return 0 } }).slice(0, 50)
          })
        )
      }
    },

    created: function () {
      document.title = this.$root.appTitle + " - " + this.$root.$t('notifications.title')

      this.render()
    },
  }
}
