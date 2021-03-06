const nodeEmoji = require('node-emoji')
const md = require('ssb-markdown')
const ref = require('ssb-ref')
const ssbSingleton = require('ssb-browser-core/ssb-singleton')

const mdOpts = {
  toUrl: (id) => {
    function doReplacement(imageURL, link) {
      // markdown doesn't support async, so we have to modify the DOM afterwards, see:
      // https://github.com/markdown-it/markdown-it/blob/master/docs/development.md#i-need-async-rule-how-to-do-it
      function replaceLink(err, newLink) {
        [ ssbErr, SSB ] = ssbSingleton.getSSB()
        if (!SSB || !SSB.isConnectedWithData) {
          // Couldn't lock the database or not fully initialized.  Try again later.
          setTimeout(function() {
            replaceLink(err, newLink)
          }, 3000)
          return
        }

        if (err) {
          // We probably can't display this because we're not connected to a peer we can download it from.
          if (!SSB.isConnectedWithData()) {
            // Try again once we're connected.
            SSB.connectedWithData(() => {
              doReplacement(imageURL, link)
            })
          }
          return
        }

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
    }

    var self = this
    var link = ref.parseLink(id)
    if (link && ref.isBlob(link.link)) {
      // This has to be done synchronously, so this poses a bit of a challenge for concurrency support.
      [ err, SSB ] = ssbSingleton.getSSB()
      if (!SSB || !(imageURL = SSB.net.blobs.remoteURL(link.link)) || imageURL == '') {
        // We're not connected to a peer - generate a unique ID so at least we have something to replace.
        imageURL = '/blobs/get/' + link.link
      }

      doReplacement(imageURL, link)

      return imageURL
    } else if (ref.isFeed(id)) {
      return `#/profile/${encodeURIComponent(id)}`
    } else if (ref.isMsg(id)) {
      return `#/thread/${encodeURIComponent(id.substring(1))}`
    } else if (typeof(id) === 'string' && id[0] === '#') {
      return `#/channel/${encodeURIComponent(id.substring(1))}`
    } else if (typeof(id) === 'string' && id[0] === '@') { // workaround bug in ssb-markdown
      return id
    }
  },
  imageLink: (ref) => ref,
  emoji: (emoji) => {
    // https://github.com/omnidan/node-emoji/issues/76
    const emojiCharacter = nodeEmoji.get(emoji).replace(/:/g, '')
    return `<span class="Emoji">${emojiCharacter}</span>`
  }
}

exports.markdown = function(text) { return md.block(text, mdOpts) }
