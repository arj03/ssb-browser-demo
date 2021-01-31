const helpers = require('./helpers')
const ref = require('ssb-ref')

Vue.component('markdown-editor', {
  template: `<div class="markdown-editor">
               <tui-editor :initialValue="postText" ref="tuiEditor" :options="editorOptions" previewStyle="tab" />
             </div>`,

  props: ['initialValue', 'privateBlobs'],

  data: function() {
    var self = this
    return {
      postText: this.initialValue,
      editorOptions: {
        usageStatistics: false,
        hideModeSwitch: true,
        initialEditType: 'markdown',
        hooks: {
          addImageBlobHook: self.addImageBlobHook
        },
        customHTMLRenderer: {
          image(node, context) {
            const { destination } = node
            const { getChildrenText, skipChildren } = context

            skipChildren()

            return {
              type: "openTag",
              tagName: "img",
              selfClose: true,
              attributes: {
                src: self.blobUrlCache[destination],
                alt: getChildrenText(node)
              }
            }
          }
        }
      },
      blobUrlCache: []
    }
  },

  methods: {
    addImageBlobHook: function(blob, cb) {
      var self = this
      helpers.handleFileSelectParts([ blob ], this.privateBlobs, (err, res) => {
        if (self.privateBlobs) {
          var link = ref.parseLink(res.link)
          if (link.query && link.query.unbox) {
            // Have to unbox it first.
            SSB.net.blobs.privateGet(link.link, link.query.unbox, (err, newLink) => {
              self.blobUrlCache[res.link] = newLink
              cb(res.link, res.name)
            })
          } else {
            SSB.net.blobs.privateFsURL(res.link, (err, blobURL) => {
              self.blobUrlCache[res.link] = blobURL
              cb(res.link, res.name)
            })
          }
        } else {
          // Public blob.
          SSB.net.blobs.fsURL(res.link, (err, blobURL) => {
            self.blobUrlCache[res.link] = blobURL
            cb(res.link, res.name)
          })
        }
      })
      return false
    },

    addBlobURLToCache: function(blobId, blobURL) {
      this.blobUrlCache[blobId] = blobURL
    },

    getMarkdown: function() {
      return this.$refs.tuiEditor.invoke('getMarkdown')
    },

    setMarkdown: function(newMarkdown) {
      this.postText = newMarkdown
      if (this.$refs.tuiEditor)
        this.$refs.tuiEditor.invoke('setMarkdown', newMarkdown)
    }
  },

  created: function () {
  }
})
