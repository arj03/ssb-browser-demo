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
                Replies: {{ (thread.msgs.length - 1 + (thread.outsideFollow || 0)) }}
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
      findOutsideFollow: function(msgs) {
        // determine if messages exists outside our follow graph
        var knownIds = [...msgs.map(x => x.key)]
        var numOutsideFollow = 0

        function insertMissingMessages(msg) {
          if (typeof msg.value.content.branch === 'string')
          {
            if (!knownIds.includes(msg.value.content.branch))
              ++numOutsideFollow
          }
          else if (Array.isArray(msg.value.content.branch))
          {
            msg.value.content.branch.forEach((branch) => {
              if (!knownIds.includes(branch))
                ++numOutsideFollow
            })
          }
        }

        msgs.forEach((msg) => {
          if (msg.value.content.type != 'post') return
          insertMissingMessages(msg)
        })

        return numOutsideFollow
      },

      renderPublic: function () {
        var self = this

        self.categories["public"] = {
          title: "Public",
          threads: {}
        }
        pull(
          SSB.net.threads.public({
            reverse: true,
            limit: this.pageSize,
            allowlist: ["post"]
          }),
          pull.collect((err, threads) => {
            self.categories["public"].threads = threads.map((x) => { return {
                title: (x.messages.length > 0 ? helpers.getMessageTitle(x.messages[0].key, x.messages[0].value) : ""),
                msgs: x.messages,
                outsideFollow: self.findOutsideFollow(x.messages)
              } })
            self.categories = Object.assign({}, this.categories)
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
