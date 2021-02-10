const MiniSearch = require('minisearch').default
const { and, descending, paginate, type, isPublic, toPullStream } = SSB.dbOperators
const pull = require('pull-stream')
const localPrefs = require('./localprefs')

var mostRecentMessage = null

function indexNewPosts(cb) {
  pull(
    SSB.db.query(
      and(type('post'), isPublic()),
      descending(),
      paginate(SSB.search.depth),
      toPullStream()
    ),
    pull.take(1),
    pull.drain((msgs) => {
      for (m in msgs) {
        if (msgs[m].key == mostRecentMessage)
          break
        if (msgs[m].value && msgs[m].value.content && msgs[m].value.content.text)
          SSB.search.miniSearch.add({ key: msgs[m].key, text: msgs[m].value.content.text })
      }
      if (msgs && msgs.length > 0)
        mostRecentMessage = msgs[0].key
      cb()
    })
  )
}

if (!SSB.search) {
  SSB.search = {
    depth: localPrefs.getSearchDepth(),
    miniSearch: new MiniSearch({
      fields: ['text'],
      idField: 'key'
    }),
    resetIndex: function() {
      mostRecentMessage = null
    },
    fullTextSearch: function(searchTerm, cb) {
      indexNewPosts(() => {
        try {
          var results = SSB.search.miniSearch.search(searchTerm, { fuzzy: 0.1 })
        } catch(e) {
          cb(e)
          return
        }

        // Sometimes MiniSearch returns duplicates.  Deduplicate them.
        var seenKeys = []
        var filteredResults = []
        for (r in results) {
          if (seenKeys.indexOf(results[r].id) < 0) {
            filteredResults.push(results[r])
            seenKeys.push(results[r].id)
          }
        }

        cb(null, filteredResults)
      })
    }
  }
}
