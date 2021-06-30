const helpers = require('./helpers')
const ref = require('ssb-ref')

Vue.component('markdown-editor', {
  template: `<div class="markdown-editor">
               <tui-editor :initialValue="postText" ref="tuiEditor" :options="editorOptions" previewStyle="tab" @change="onChange" @focus="hideSuggestions" @blur="hideSuggestionsLater" />
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

    suggestChannels: function(searchString, cb) {
      const searchForChannel = searchString.substring(1, searchString.length)
      const allChannels = SSB.db.getIndex("channels").getChannels()
      const sortFunc = (new Intl.Collator()).compare
      const filteredChannels = allChannels.filter((x) => { return x.toLowerCase().startsWith(searchForChannel.toLowerCase()) })
        .sort(sortFunc)
        .slice(0, 5)
      var suggestions = []
      for (c in filteredChannels)
        suggestions.push({ text: "#" + filteredChannels[c], value: filteredChannels[c] })
      cb(null, suggestions)
    },

    clickChannel: function(channel) {
      return "#" + channel
    },

    suggestPeople: function(searchString, cb) {
      const matches = SSB.searchProfiles(searchString.substring(1))
      matches.forEach(p => {
        if (p && p.imageURL)
          p.image = p.imageURL
        else
          p.image = helpers.getMissingProfileImage()
      })
      const sortFunc = new Intl.Collator().compare
      const sortedPeople = matches.sort((a, b) => { return sortFunc(a.name, b.name) })
      const suggestions = sortedPeople.slice(0, 5).map((x) => { return { icon: x.image, text: x.name, value: x } })
      cb(null, suggestions)
    },

    clickPeople: function(person) {
      // Add a person at the cursor.
      return "[@" + person.name + "](" + person.id + ")"
    },

    popupSuggestions: function(suggest, optionList, replaceStart, replaceEnd) {
      var self = this
      const editorSelInfo = this.$refs.tuiEditor.editor.mdEditor.view.coordsAtPos(this.$refs.tuiEditor.editor.mdEditor.view.state.selection.head)
      const cursorXY = { x: editorSelInfo.left, y: editorSelInfo.bottom }
      const positionParent = document.body
      var popupEl = positionParent.getElementsByClassName("suggestion-box")[0]
      if (!popupEl) {
        popupEl = positionParent.appendChild(document.createElement("div"))
        popupEl.className = "suggestion-box toastui-editor-popup toastui-editor-popup-add-heading"
        popupEl.appendChild(document.createElement("div")).className = "toastui-editor-popup-body"

        // Fix the position in place at the initial opening.
        popupEl.style.position = "absolute"
        popupEl.style.left = cursorXY.x + "px"
        popupEl.style.top = cursorXY.y + "px"
      }

      // Keep it hidden until there are options to show, but we can at least initialize so the position's fixed.
      popupEl.style.display = (optionList.length > 0 ? "block" : "none")
      if (!popupEl.firstChild.firstChild)
        popupEl.firstChild.appendChild(document.createElement("ul"))
      var listEl = popupEl.firstChild.firstChild
      while (listEl.firstChild)
        listEl.removeChild(listEl.firstChild)
      for (o in optionList) {
        var liEl = listEl.appendChild(document.createElement("li"))
        if (optionList[o].icon) {
          var imgEl = document.createElement("img")
          imgEl.src = optionList[o].icon
          imgEl.style.width = (suggest.iconSize || "16px")
          imgEl.style.maxHeight = (suggest.iconSize || "16px")
          imgEl.style.marginRight = "2px"
          imgEl.style.marginLeft = "-8px"
          imgEl.style.verticalAlign = "middle"
          liEl.appendChild(imgEl)
        }
        liEl.appendChild(document.createTextNode(optionList[o].text))
        liEl.addEventListener("click", function (value) { return function(e) {
          self.useSuggestion(replaceStart, replaceEnd, suggest.click(value))
          e.stopPropagation()
          return false
        } }(optionList[o].value))
        // Something's hooking mousedown on this and cancelling it so click never fires.  This prevents the event from bubbling and getting cancelled.
        liEl.addEventListener("mousedown", function(e) { e.stopPropagation(); e.preventDefault(); return false; } )
      }
    },

    useSuggestion: function(replaceStart, replaceEnd, suggestionMarkdown) {
      // Replace the current token with our new content.
      const startingMarkdown = this.$refs.tuiEditor.editor.getMarkdown()
      console.log("Replacing " + startingMarkdown.substring(replaceStart, replaceEnd) + " with " + suggestionMarkdown)
      this.$refs.tuiEditor.editor.setMarkdown(startingMarkdown.substring(0, replaceStart) + suggestionMarkdown + startingMarkdown.substring(replaceEnd, startingMarkdown.length))
      this.hideSuggestions()
    },

    hideSuggestions: function() {
      var popupEl = document.body.getElementsByClassName("suggestion-box")[0]
      if (popupEl) {
        popupEl.parentNode.removeChild(popupEl)
      }
    },

    hideSuggestionsLater: function() {
      // This is here because ToastUI now fires the blur event before the onclick event of the suggestion box can be fired, hiding the box before it can fire.
      setTimeout(this.hideSuggestions, 100)
    },

    onChange: function() {
      // Figure out where the cursor is at and if we're in a position to pop up a suggestion.
      // Search backwards to the beginning of this token.
      var self = this
      const tokenSeparatorChars = " ,()[]{};:.'\"!"
      // Ensure editor is initialized, because onChange can happen before initialization.
      if (!this.$refs.tuiEditor.editor) return
      const selInfo = this.$refs.tuiEditor.editor.getSelection()
      const markdownLines = this.$refs.tuiEditor.editor.getMarkdown().split("\n")
      const editorContainerEl = this.$refs.tuiEditor.editor.mdEditor.editorContainerEl
      // Ensure we only have a cursor and not a selection.
      if (!selInfo[0] || selInfo[0][0] != selInfo[1][0] || selInfo[0][1] != selInfo[1][1]) return
      const cursorPos = { line: selInfo[0][0] - 1, ch: selInfo[0][1] - 1 }
      const cursorLine = markdownLines[cursorPos.line]
      var tokenStart = cursorPos.ch - 1
      for (; tokenStart >= 0; --tokenStart) {
        if (tokenSeparatorChars.indexOf(cursorLine.charAt(tokenStart)) >= 0) break
      }
      var tokenEnd = cursorPos.ch
      for (; tokenEnd < cursorLine.length; ++tokenEnd) {
        if (tokenSeparatorChars.indexOf(cursorLine.charAt(tokenEnd)) >= 0) break
      }
      const token = cursorLine.substring(tokenStart + 1, tokenEnd)
      const suggestionChars = {
        '#': { list: this.suggestChannels, click: this.clickChannel },
        '@': { list: this.suggestPeople, click: this.clickPeople }
      }
      if (token && (suggest = suggestionChars[token.charAt(0)])) {
        // This is a type of token we support.
        // Figure out where in the raw Markdown the token actually is.
        var replaceStart = 0
        for (l = 0; l < cursorPos.line; ++l)
          replaceStart += markdownLines[l].length + 1
        replaceStart += tokenStart + 1

        suggest.list(token, (err, optionList) => {
          self.popupSuggestions(suggest, optionList, replaceStart, replaceStart + token.length)
        })
      } else {
        self.hideSuggestions()
      }
    },

    insertMarkdown: function(markdown) {
      this.$refs.tuiEditor.editor.insertText(markdown)
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
