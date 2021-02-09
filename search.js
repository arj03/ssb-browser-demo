const MiniSearch = require('minisearch').default
const { and, descending, paginate, type, toPullStream } = SSB.dbOperators
const pull = require('pull-stream')

var mostRecentMessage = null

function indexNewPosts(cb) {
  pull(
    SSB.db.query(
      and(type('post')),
      descending(),
      paginate(10000),
      toPullStream()
    ),
    pull.drain((msgs) => {
      for (m in msgs) {
        if (msgs[m].key == mostRecentMessage)
          break
        if (msgs[m].value && msgs[m].value.content && msgs[m].value.content.text)
          SSB.miniSearch.add({ key: msgs[m].key, text: msgs[m].value.content.text })
      }
      if (msgs && msgs.length > 0)
        mostRecentMessage = msgs[0].key
      cb()
    })
  )
}

if (!SSB.miniSearch) {
  SSB.miniSearch = new MiniSearch({
    fields: ['text'],
    idField: 'key'
  })

  SSB.fullTextSearch = function(searchTerm, cb) {
    indexNewPosts(() => {
      cb(null, SSB.miniSearch.search(searchTerm, { fuzzy: 0.1 }))
    })
  }
}
