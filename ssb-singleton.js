const { WindowController } = require("./window-controller.js")
const localPrefs = require('./localprefs')
const pull = require('pull-stream')

window.windowController = new WindowController()

var onErrorCallbacks = []
var onSuccessCallbacks = []
var ssbChangedCallbacks = []
var lastSSB = null

function ssbLoaded() {
  // add helper methods
  SSB = window.singletonSSB
  require('./net')
  require('./profile')
  require('./search')

  pull(SSB.net.conn.hub().listen(), pull.drain((ev) => {
    if (ev.type.indexOf("failed") >= 0)
      console.warn("Connection error: ", ev)
  }))
}

function initSSB() {
  const optionsForCore = {
    caps: { shs: Buffer.from(localPrefs.getCaps(), 'base64') },
    friends: {
      hops: localPrefs.getHops(),
      hookReplicate: false
    },
    hops: localPrefs.getHops(),
    core: {
      startOffline: localPrefs.getOfflineMode()
    },
    conn: {
      autostart: false,
      hops: localPrefs.getHops(),
      populatePubs: false
    }
  }
  // Before we start up ssb-browser-core, let's check to see if we do not yet have an id, since this would mean that we need to display the onboarding screen.
  const ssbKeys = require('ssb-keys')
  window.firstTimeLoading = false
  try {
    ssbKeys.loadSync('/.ssb-lite/secret')
  } catch(err) {
    window.firstTimeLoading = true
  }
  if (window.updateFirstTimeLoading)
    window.updateFirstTimeLoading()
  require('ssb-browser-core/core').init("/.ssb-lite", optionsForCore);
  SSB.uniqueID = (new Date()).getTime()
  window.singletonSSB = SSB // Using a different name so that anything trying to use the non-singleton global will fail so we can find them.

  if (SSB.events._events["SSB: loaded"])
    ssbLoaded()
  else
    SSB.events.once('SSB: loaded', ssbLoaded)
}

function runOnChangeIfNeeded(SSB) {
  if (lastSSB != SSB.uniqueID) {
    lastSSB = SSB.uniqueID
    for (f in ssbChangedCallbacks)
      ssbChangedCallbacks[f]()
  }
}

function runOnError(err) {
  for (f in onErrorCallbacks)
    onErrorCallbacks[f](err)
}

function runOnSuccess() {
  for (f in onSuccessCallbacks)
    onSuccessCallbacks[f]()
}

// Allows for registering callbacks which run any time the active SSB is switched, including if we initialize or we have to register with a new SSB in another window.
module.exports.onChangeSSB = function(cb) {
  ssbChangedCallbacks.push(cb)
}

module.exports.onError = function(cb) {
  onErrorCallbacks.push(cb)
}

module.exports.onSuccess = function(cb) {
  onSuccessCallbacks.push(cb)
}

module.exports.getSSB = function() {
  if (window.singletonSSB) {
    if (windowController.isMaster) {
      // We're already holding an SSB object, so we can return it right away.
      runOnChangeIfNeeded(window.singletonSSB)
      runOnSuccess()
      return [ null, window.singletonSSB ]
    } else {
      // We have an initialized SSB but lost our WindowController status, which means we probably froze up for long enough that another window gave up on listening for our heatbeat pings.
      // We need to get rid of our SSB object as soon as possible and then fall back to trying to get it from another window.
      delete window.singletonSSB
    }
  }
  if (windowController.isMaster) {
    // We've been elected as the SSB holder window but have no SSB yet.  Initialize an SSB object.
    initSSB()
    runOnChangeIfNeeded(window.singletonSSB)
    runOnSuccess()
    return [ null, window.singletonSSB ]
  } else {
    // We're not supposed to be running an SSB.  But there might be another window with one.
    if (window.opener && window.opener.singletonSSB) {
      // See if they're still alive.
      if (window.windowController.others && window.windowController.others[window.opener.windowController.id]) {
        // They're still responding to pings.
        runOnChangeIfNeeded(window.opener.singletonSSB)
        runOnSuccess()
        return [ null, window.opener.singletonSSB ]
      }
    }
  }
  const err = "Acquiring database lock - Only one instance of ssb-browser is allowed to run at a time."
  runOnError(err)
  return [ err, null ]
}

module.exports.getSSBEventually = function(timeout, isRelevantCB, ssbCheckCB, resultCB) {
  // If the caller no longer needs a result, return right away before processing anything.
  if (isRelevantCB && !isRelevantCB()) return;

  [ err, SSB ] = this.getSSB()

  // Do this here so that if we time out and return, SSB is set to null if it doesn't pass.
  // That way a simple if(SSB) is all it takes on the client end.
  SSB = (!err && ssbCheckCB(SSB) ? SSB : null)

  if (!SSB) {
    if (timeout != 0) {
      // Try again.
      var self = this
      setTimeout(function() {
        self.getSSBEventually((timeout > 0 ? Math.max(0, timeout - 500) : timeout), isRelevantCB, ssbCheckCB, resultCB)
      }, 500)
      return
    } else if (!err) {
      // We timed out but don't have an error, so we should set one before the callback below runs.
      err = "Could not lock database"
    }
  }
  resultCB(err, SSB)
}
