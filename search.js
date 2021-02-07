const MiniSearch = require('minisearch').default
const { and, descending, startFrom, paginate, type, live, toPullStream } = SSB.dbOperators
const pull = require('pull-stream')

var indexStart = 0

function indexExistingPosts() {
  pull(
    SSB.db.query(
      and(type('post')),
      descending(),
      startFrom(indexStart),
      paginate(1000),
      toPullStream()
    ),
    pull.drain((msgs) => {
      for (m in msgs) {
        if (msgs[m].value && msgs[m].value.content && msgs[m].value.content.text)
          SSB.miniSearch.add({ key: msgs[m].key, text: msgs[m].value.content.text })
      }

      // Queue up indexing of another batch.
      if (msgs.length > 0) {
        indexStart += 1000
        if (indexStart < 100000)
          setTimeout(indexExistingPosts, 5000)
      }
    })
  )
}

if (!SSB.miniSearch) {
  SSB.miniSearch = new MiniSearch({
    fields: ['text'],
    idField: 'key'
  })

  setTimeout(indexExistingPosts, 3000)

  // Start a live feed for indexing new messages.
  pull(
    SSB.db.query(
      and(type('post')),
      live(),
      toPullStream(),
      pull.drain((msg) => {
        if (msg.value && msg.value.content && msg.value.content.text)
          SSB.miniSearch.add({ key: msg.key, text: msg.value.content.text })
      })
    )
  )

  SSB.fullTextSearch = function(searchTerm) {
    return SSB.miniSearch.search(searchTerm, { fuzzy: 0.1 })
  }
}
