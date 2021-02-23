const MutationObserver = window.MutationObserver || window.WebKitMutationObserver

function onClick(e) {
  if (e.button == 1) {
    console.log("Caught middle button")
    window.open(e.target.href)
    e.preventDefault()
    e.stopPropagation()
    return false
  }
}

function addHandlersIfNeeded(a) {
  if (a.classList.contains("click-caught"))
    return

  a.addEventListener("click", onClick)
  a.addEventListener("auxclick", onClick)

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
