module.exports = function () {
  const pull = require('pull-stream')
  const ssbMentions = require('ssb-mentions')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  return {
    template: `
       <div id="search">
         <h2>{{ $t('search.title', { search: search }) }}</h2>
         <p>{{ $t('search.searchLimitNote', { results: pageSize, depth: searchDepth }) }}</p>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
         <p v-if="messages.length == 0 && !triedToLoadMessages">{{ $t('common.searchingForMessages') }}</p>
         <p v-if="messages.length == 0 && triedToLoadMessages">{{ $t('common.noMessages') }}</p>
         </p>
       <div>`,

    props: ['search'],
    
    data: function() {
      return {
        componentStillLoaded: false,
        triedToLoadMessages: false,
        searchDepth: 10000,
        pageSize: 50,
        messages: []
      }
    },

    methods: {
      loadMore: function() {
        ssbSingleton.getSimpleSSBEventually(() => this.componentStillLoaded, this.loadMoreCB)
      },

      loadMoreCB: function(err, SSB) {
        const { where, or, author, isPublic, type, key, descending, paginate, toCallback } = SSB.dbOperators
        this.searchDepth = SSB.search.depth
        try {
          SSB.search.fullTextSearch(this.search, (err, results) => {
            if (results && results.length > 0) {
              SSB.db.query(
                where(
                  or(...results.slice(0, 50).map(x => key(x.id)))
                ),
                descending(),
                paginate(this.pageSize),
                toCallback((err, answer) => {
                  this.triedToLoadMessages = true
                  this.messages = this.messages.concat(answer.results || answer)
                })
              )
            } else {
              // No search results.
              this.triedToLoadMessages = true
            }
          })
        } catch(e) {
          // Probably no messages and crashed the query with "TypeError: Cannot set property 'meta' of undefined"
          this.triedToLoadMessages = true
        }
      },

      render: function () {
        document.title = this.$root.appTitle + " - " + this.$root.$t('search.title', { search: this.search })

        this.loadMore()
      }
    },

    created: function () {
      this.componentStillLoaded = true
      this.render()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    },

    watch: {
      search: function (oldValue, newValue) {
        this.messages = []
        this.triedToLoadMessages = false
        this.render()
      }
    }
  }
}
