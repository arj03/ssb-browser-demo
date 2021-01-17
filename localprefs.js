const defaultPrefs = require("./defaultprefs.json")

function getPref(prefName, defValue) {
  const pref = localStorage.getItem('/.ssb-browser-demo/' + prefName);
  if(pref && pref != '')
    return pref

  return defValue
}

function setPref(prefName, value) {
  localStorage.setItem('/.ssb-browser-demo/' + prefName, value)
}

exports.getHops = function() { return getPref('replicationHops', (defaultPrefs.replicationHops || 1)) }

exports.setHops = function(hops) { setPref('replicationHops', hops) }

exports.getCaps = function() {
  const caps = require("ssb-caps")
  return getPref('caps', caps.shs)
}

exports.setCaps = function(caps) { setPref('caps', caps) }

exports.getAppTitle = function() { return getPref('appTitle', (defaultPrefs.appTitle || 'SSB Browser Demo')) }

exports.setAppTitle = function(title) { setPref('appTitle', title) }

exports.getTheme = function() { return getPref('theme', (defaultPrefs.theme || 'default')) }

exports.setTheme = function(theme) { setPref('theme', theme) }

exports.updateStateFromSettings = function() {
  // Update the running state to match the stored settings.
  SSB.hops = this.getHops()
  if(SSB.net)
    SSB.net.config.conn.hops = this.getHops()

  document.title = this.getAppTitle()
  document.body.classList.add('theme-' + this.getTheme())
  for(var i = 0; i < document.body.classList.length; ++i) {
    const cur = document.body.classList.item(i)
    if(cur.substring(0, ('theme-').length) == 'theme-' && cur != 'theme-' + this.getTheme()) {
      document.body.classList.remove(cur)
      --i
    }
  }
}
