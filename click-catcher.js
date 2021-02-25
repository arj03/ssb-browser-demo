const ssbSingleton = require("./ssb-singleton")
const copy = require("clipboard-copy")

const MutationObserver = window.MutationObserver || window.WebKitMutationObserver

function onClick(e) {
  if (e.button == 1) {
    console.log("Caught middle button")
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
  if (!a.__vue__ || !href || href.indexOf("://") >= 0) return

  var options = [
    { name: "Open in new tab", cb: openInNewTab }
  ]
  if (href.startsWith("#/profile/")) {
    var id = decodeURIComponent(href.substring(("#/profile/").length))
    options.push({
      name: "Copy ID",
      cb: () => { copy(id) }
    })
  }

  console.log("Caught right click")
  const contextMenu = a.__vue__.$root.$refs.linkContextMenu
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
