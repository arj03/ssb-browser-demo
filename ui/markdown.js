const nodeEmoji = require('node-emoji')
const md = require('ssb-markdown')
const ref = require('ssb-ref')

const mdOpts = {
  toUrl: (id) => {
    var link = ref.parseLink(id)
    if (link && ref.isBlob(link.link))
    {
      if (link.query && link.query.unbox) // private
      {
        // FIXME: doesn't work the first time
        SSB.net.blobs.privateGet(link.link, link.query.unbox, () => {})
        return SSB.net.blobs.privateFsURL(link.link)
      }
      else
        return SSB.net.blobs.remoteURL(link.link)
    }
    else if (ref.isFeed(id))
    {
      return `#/profile/${encodeURIComponent(id)}`
    }
    else if (ref.isMsg(id))
    {
      return `#/thread/${encodeURIComponent(id.substring(1))}`
    }
    else
      return id
  },
  emoji: (emoji) => {
    // https://github.com/omnidan/node-emoji/issues/76
    const emojiCharacter = nodeEmoji.get(emoji).replace(/:/g, '')
    return `<span class="Emoji">${emojiCharacter}</span>`
  }
}

exports.markdown = function(text) { return md.block(text, mdOpts) }
