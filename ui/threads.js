module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const localPrefs = require('../localprefs')
  const { and, or, not, channel, isRoot, hasRoot, isPublic, type, author, startFrom, paginate, descending, toCallback } = SSB.dbOperators

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
        pageSize: 50,
        displayPageEnd: 50
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

      renderPublic: function () {
        var self = this

        self.categories["public"] = {
          title: "Public",
          threads: {}
        }
        SSB.db.query(
          and(type('post'), isRoot(), isPublic()),
          startFrom(self.offset),
          paginate(this.pageSize),
          descending(),
          toCallback((err, answer) => {
            self.fillInCategory("public", answer.results)
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
