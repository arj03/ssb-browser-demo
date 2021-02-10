const { and, descending, paginate, type, toPullStream } = SSB.dbOperators
const pull = require('pull-stream')
const localPrefs = require('./localprefs')

var mostRecentMessage = null

function indexNewPosts(cb) {
  pull(
    SSB.db.query(
      and(type('post')),
      descending(),
      paginate(SSB.search.depth),
      toPullStream()
    ),
    pull.drain((msgs) => {
      for (m in msgs) {
        if (msgs[m].key == mostRecentMessage)
          break
        if (msgs[m].value && msgs[m].value.content && msgs[m].value.content.text)
          SSB.search.flexSearchIndex.add({ id: msgs[m].key, key: msgs[m].key, text: msgs[m].value.content.text })
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
    flexSearchIndex: FlexSearch.create("speed", {
      doc: {
        id: "key",
        field: "text"
      }
    }),
    resetIndex: function() {
      mostRecentMessage = null
    },
    fullTextSearch: function(searchTerm, cb) {
      indexNewPosts(() => {
        try {
          SSB.search.flexSearchIndex.search(searchTerm, (results) => {
            cb(null, results)
          })
        } catch(e) {
          cb(e)
          return
        }
      })
    }
  }
}
