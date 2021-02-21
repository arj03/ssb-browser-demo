module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const localPrefs = require('../localprefs')
  const { and, or, not, channel, isRoot, hasRoot, isPublic, type, author, key, startFrom, paginate, descending, toCallback } = SSB.dbOperators
  const sort = require('ssb-sort')

  return {
    template: `
    <div id="threads">
      <div v-for="category in categories">
        <table>
          <thead><tr><th>{{ category.title }}</th><th>Replies</th><th>Last post</th></tr></thead>
          <tbody>
            <tr v-for="thread in category.threads">
              <td>
                <router-link :to="{name: 'thread', params: { rootId: thread.msgs[0].key.substring(1) }}">{{ thread.title }}</router-link><br />
                <small>
                  Started by
                  <ssb-profile-link v-bind:feedId="thread.msgs[0].value.author"></ssb-profile-link>
                  <ssb-profile-name-link v-bind:feedId="thread.msgs[0].value.author"></ssb-profile-name-link>
                  , {{ (new Date(thread.msgs[0].value.timestamp)).toLocaleString() }}
                </small>
              </td>
              <td>
                Replies: {{ thread.msgs.length - 1 }}
              </td>
              <td>
                <ssb-profile-link v-bind:feedId="thread.msgs[thread.msgs.length - 1].value.author"></ssb-profile-link>
                <ssb-profile-name-link v-bind:feedId="thread.msgs[thread.msgs.length - 1].value.author"></ssb-profile-name-link><br />
                <small>{{ (new Date(thread.msgs[thread.msgs.length - 1].value.timestamp)).toLocaleString() }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="categories.length < 1">
        No threads found
      </div>
    </div>`,

    data: function() {
      var self = this
      return {
        categories: {},
        offset: 0,
        pageSize: 30,
        displayPageEnd: 30
      }
    },

    methods: {
      fetchMessages: function(threadRootId, cb) {
        SSB.db.query(
          and(hasRoot(threadRootId)),
          toCallback((err, answer) => {
            cb(err, threadRootId, answer)
          })
        )
      },

      fillInCategory: function(categoryKey, threadRoots) {
        var self = this

        var threads = {}
        for (r in threadRoots) {
          threads[threadRoots[r].key] = {
            title: helpers.getMessageTitle(threadRoots[r].key, threadRoots[r].value),
            msgs: threadRoots.slice(r * 1, r * 1 + 1)
          }
        }
        
        this.categories[categoryKey].threads = threads
        // And because Vue.js can't detect deep object property changes:
        this.categories = Object.assign({}, this.categories)

        // Now that the thread root list is filled in (to prevent race conditions), fetch messages.
        for (t in this.categories[categoryKey].threads) {
          this.fetchMessages(t, (err, threadRootId, replies) => {
            // determine if messages exists outside our follow graph
            var knownIds = [threadRootId, ...replies.map(x => x.key)]

            function insertMissingMessages(msg) {
              if (typeof msg.value.content.branch === 'string')
              {
                if (!knownIds.includes(msg.value.content.branch)) {
                  replies.push({
                    key: msg.value.content.branch,
                    value: {
                      content: {
                        text: self.$root.$t('common.messageOutsideGraph')
                      }
                    }
                  })
                }
              }
              else if (Array.isArray(msg.value.content.branch))
              {
                msg.value.content.branch.forEach((branch) => {
                  if (!knownIds.includes(branch)) {
                    replies.push({
                      key: branch,
                      value: {
                        content: {
                          text: self.$root.$t('common.messageOutsideGraph')
                        }
                      }
                    })
                  }
                })
              }
            }

            replies.forEach((msg) => {
              if (msg.value.content.type != 'post') return

              insertMissingMessages(msg)
              replies.push(msg)
            })

            replies = sort(replies)
            
            // Replies may contain duplicates, so we need to deduplicate them.
            var seenKeys = []
            for (r in replies) {
              if (seenKeys.indexOf(replies[r].key) < 0) {
                this.categories[categoryKey].threads[threadRootId].msgs.push(replies[r])
                seenKeys.push(replies[r].key)
              }
            }
            this.categories = Object.assign({}, this.categories)
          })
        }
      },

      pullRoots: function(categoryKey, messages) {
        var self = this
        var rootKeys = messages.map((x) => { return x.value.content.root || x.key })
          .filter((x, index, self) => { return self.indexOf(x) == index })
        SSB.db.query(
          and(type('post'), isRoot(), or(...rootKeys.map((x) => key(x)))),
          toCallback((err, answer) => {
            if (answer) {
              // Sort the resulting messages by the order in rootKeys, since that's the "last updated" order.
              var threadRoots = answer.sort((a, b) => { return rootKeys.indexOf(a.key) - rootKeys.indexOf(b.key) })
                .filter((x, index, self) => { return self.indexOf(x) == index })
                .slice(0, this.pageSize)
              self.fillInCategory(categoryKey, threadRoots)
            }
          })
        )
      },

      renderPublic: function () {
        var self = this

        self.categories["public"] = {
          title: "Public",
          threads: {}
        }
        SSB.db.query(
          and(type('post'), isPublic()),
          startFrom(self.offset),
          paginate(this.pageSize * 5), // Pull some extra messages so we get roughly the right number of thread roots.  Determined experimentally.
          descending(),
          toCallback((err, answer) => {
            if (answer)
              self.pullRoots("public", answer.results)
          })
        )
      }
    },

    created: function () {
      var self = this

      document.title = this.$root.appTitle + " - " + this.$root.$t('threads.title')

      this.renderPublic()
    }
  }
}
