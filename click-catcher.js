const ssbSingleton = require('ssb-browser-core/ssb-singleton')
const copy = require("clipboard-copy")

const MutationObserver = window.MutationObserver || window.WebKitMutationObserver

function onClick(e) {
  if (e.button == 1 || (e.button == 0 && e.ctrlKey)) {
    ssbSingleton.openWindow(e.currentTarget ? e.currentTarget.href : e.target.href)
    e.preventDefault()
    e.stopPropagation()
    return false
  }
}

function openInNewTab(a) {
  ssbSingleton.openWindow(a.href)
}

function onContextMenu(e) {
  // Is it even an internal link?
  var a = (e.currentTarget || e.target)
  var href = a.getAttribute("href") // Can't just use a.href because that gets absolutized.
  var vueHolder = a
  while (!vueHolder.__vue__ && vueHolder.parentNode) vueHolder = vueHolder.parentNode
  if (!vueHolder.__vue__ || !href || href.indexOf("://") >= 0 || href.startsWith("javascript:")) return

  var options = [
    { name: "Open in new tab", cb: openInNewTab }
  ]
  if (href.startsWith("#/profile/")) {
    var id = decodeURIComponent(href.substring(("#/profile/").length))
    options.push({
      name: "Copy ID",
      cb: () => { copy(id) }
    })

    [ err, SSB ] = ssbSingleton.getSSB()
    if (SSB && (name = SSB.getProfileName(id))) {
      options.push({
        name: "Copy Markdown link",
        cb: () => { copy("[@" + name + "](" + id + ")") }
      })
    }
  } else if (href.startsWith("#/thread/")) {
    var id = "%" + decodeURIComponent(href.substring(("#/thread/").length))
    options.push({
      name: "Copy ID",
      cb: () => { copy(id) }
    })
  }

  const contextMenu = vueHolder.__vue__.$root.$refs.commonContextMenu
  contextMenu.showMenu(e, options, a)

  e.preventDefault()
  e.stopPropagation()
  return false
}

function addHandlersIfNeeded(a) {
  if (a.classList.contains("click-caught"))
    return

  a.addEventListener("click", onClick)
  a.addEventListener("auxclick", onClick)
  a.addEventListener("contextmenu", onContextMenu)

  a.classList.add("click-caught")
}

function observerCallback(mutationsList, observer) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      for (var n = 0; n < mutation.addedNodes.length; ++n) {
        var node = mutation.addedNodes[n]
        if (node && node.tagName) {
          if (node.tagName.toLowerCase() == "a") {
            addHandlersIfNeeded(node)
          } else {
            var allA = node.getElementsByTagName("a")
            for (var a = 0; a < allA.length; ++a)
              addHandlersIfNeeded(allA[a])
          }
        }
      }
    }
  }
}

module.exports.start = function() {
  // First, add the handler to all links which already exist in the DOM.
  var allA = document.getElementsByTagName("a")
  for (var a = 0; a < allA.length; ++a)
    addHandlersIfNeeded(allA[a])

  // Now install a mutation observer to watch for new elements being added.
  if (!window.clickObserver) {
    window.clickObserver = new MutationObserver(observerCallback)
    window.clickObserver.observe(document.documentElement, { childList: true, subtree: true })
  }
}
