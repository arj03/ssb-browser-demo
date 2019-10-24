const nodeEmoji = require('node-emoji')
const md = require('ssb-markdown')
const ref = require('ssb-ref')

const mdOpts = {
  toUrl: (id) => {
    var link = ref.parseLink(id)
    if (link && ref.isBlob(link.link)) {
      var imageURL = SSB.net.blobs.remoteURL(link.link)

      // markdown doesn't support async, so we have to modify the DOM afterwards, see:
      // https://github.com/markdown-it/markdown-it/blob/master/docs/development.md#i-need-async-rule-how-to-do-it
      function replaceLink(err, newLink) {
        if (imageURL != newLink)
        {
          var els = document.querySelectorAll(`img[src='${imageURL}']`)
          for (var i = 0, l = els.length; i < l; ++i) {
            els[i].src = newLink
          }
        }
      }

      if (link.query && link.query.unbox) { // private
        SSB.net.blobs.privateGet(link.link, link.query.unbox, replaceLink)
      }
      else {
        SSB.net.blobs.localGet(link.link, replaceLink)
      }

      return imageURL
    } else if (ref.isFeed(id)) {
      return `#/profile/${encodeURIComponent(id)}`
    } else if (ref.isMsg(id)) {
      return `#/thread/${encodeURIComponent(id.substring(1))}`
    } else
      return id
  },
  imageLink: (ref) => { return '#' },
  emoji: (emoji) => {
    // https://github.com/omnidan/node-emoji/issues/76
    const emojiCharacter = nodeEmoji.get(emoji).replace(/:/g, '')
    return `<span class="Emoji">${emojiCharacter}</span>`
  }
}

exports.markdown = function(text) { return md.block(text, mdOpts) }
