module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const helpers = require('./helpers')
  const localPrefs = require('../localprefs')
  const sort = require('ssb-sort')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  return {
    template: `
    <div id="threads">
      <h2>{{ $t('common.lastXThreads', { count: pageSize }) }}
        <a href="javascript:void(0);" :title="$t('common.refreshMessages')" id="refresh" class="refresh" v-on:click="refresh">&#8635;</a>
      </h2>
      <div v-for="category in categories">
        <table>
          <thead><tr><th>{{ category.title }}</th><th>Replies</th><th>Last post</th></tr></thead>
          <tbody>
            <tr v-if="!category.threads || category.threads.length < 1"><td colspan="3">{{ $t('threads.searching') }}</td></tr>
            <tr v-for="thread in category.threads">
              <td>
                <router-link :to="{name: 'thread', params: { rootId: thread.msgs[0].key.substring(1) }}" v-bind:title="thread.preview">{{ thread.title }}</router-link><br />
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
                <small v-bind:title="thread.lastMsgPreview">{{ (new Date(thread.msgs[thread.msgs.length - 1].value.timestamp)).toLocaleString() }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="Object.keys(categories).length < 1">
        {{ $t('threads.searching') }}
      </div>
    </div>`,

    data: function() {
      var self = this
      return {
        componentStillLoaded: false,
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

      refresh: function() {
        this.categories = {}
        this.renderPublic()
      },

      renderPublic: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.renderPublicCB)
      },

      renderPublicCB: function (err, SSB) {
        const { and, or, not, channel, isRoot, hasRoot, isPublic, type, author, key, startFrom, paginate, descending, toCallback } = SSB.dbOperators
        var self = this

        self.categories["public"] = {
          title: "Public",
          threads: {}
        }
        pull(
          SSB.net.threads.public({
            reverse: true,
            allowlist: ["post"]
          }),
          pull.take(this.pageSize),
          pull.collect((err, threads) => {
            componentsState.newPublicMessages = false

            self.categories["public"].threads = threads.map((x) => {
              return {
                title: (x.messages.length > 0 ? helpers.getMessageTitle(x.messages[0].key, x.messages[0].value) : ""),
                preview: (x.messages.length > 0 ? helpers.getMessagePreview(x.messages[0].value, 500) : ""),
                lastMsgPreview: (x.messages.length > 0 ? helpers.getMessagePreview(x.messages[x.messages.length - 1].value, 500) : ""),
                msgs: x.messages,
                outsideFollow: self.findOutsideFollow(x.messages)
              }
            })
            self.categories = Object.assign({}, this.categories)
          })
        )
      }
    },

    created: function () {
      var self = this

      this.componentStillLoaded = true

      document.title = this.$root.appTitle + " - " + this.$root.$t('threads.title')

      this.renderPublic()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    }
  }
}
