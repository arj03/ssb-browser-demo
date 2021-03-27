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

exports.getPublicFilters = function() { return getPref('publicFilters', (defaultPrefs.publicFilters || '')) }

exports.setPublicFilters = function(filterNamesSeparatedByPipes) { setPref('publicFilters', filterNamesSeparatedByPipes) }

exports.getFavoriteChannels = function() { return JSON.parse(getPref('favoriteChannels', JSON.stringify(defaultPrefs.favoriteChannels || []))) }

exports.setFavoriteChannels = function(favoriteChannelsArray) { setPref('favoriteChannels', JSON.stringify(favoriteChannelsArray)) }

exports.getFavoriteGroups = function() { return JSON.parse(getPref('favoriteGroups', JSON.stringify(defaultPrefs.favoriteGroups || []))) }

exports.setFavoriteGroups = function(favoriteGroupsArray) { setPref('favoriteGroups', JSON.stringify(favoriteGroupsArray)) }

exports.getHiddenChannels = function() { return JSON.parse(getPref('hiddenChannels', JSON.stringify(defaultPrefs.hiddenChannels || []))) }

exports.setHiddenChannels = function(hiddenChannelsArray) { setPref('hiddenChannels', JSON.stringify(hiddenChannelsArray)) }

exports.getLocale = function() { return getPref('locale', (defaultPrefs.locale || '')) }

exports.setLocale = function(locale) { setPref('locale', locale) }

exports.getAutorefresh = function() { return (getPref('autorefresh', (typeof defaultPrefs.autorefresh != 'undefined' ? (defaultPrefs.autorefresh ? 'true' : 'false') : 'false')) != 'false') }

exports.setAutorefresh = function(isOn) { setPref('autorefresh', (isOn ? 'true' : 'false')) }

exports.getSearchDepth = function() { return getPref('searchDepth', (defaultPrefs.searchDepth || 10000)) }

exports.setSearchDepth = function(numMessages) { setPref('searchDepth', numMessages) }

exports.getOfflineMode = function() { return (getPref('offlineMode', (typeof defaultPrefs.offlineMode != 'undefined' ? (defaultPrefs.offlineMode ? 'true' : 'false') : 'true')) == 'true') }

exports.setOfflineMode = function(isOn) { setPref('offlineMode', (isOn ? 'true' : 'false')) }

exports.getUserGroups = function() { return JSON.parse(getPref('userGroups', JSON.stringify(defaultPrefs.userGroups || []))) }

exports.setUserGroups = function(userGroupArray) { setPref('userGroups', JSON.stringify(userGroupArray)) }

exports.getDetailedLogging = function() { return (getPref('detailedLogging', (typeof defaultPrefs.detailedLogging != 'undefined' ? (defaultPrefs.detailedLogging ? 'true' : 'false') : 'false')) != 'false') }

exports.setDetailedLogging = function(isOn) { setPref('detailedLogging', (isOn ? 'true' : 'false')) }

exports.getDHTEnabled = function() { return (getPref('dhtEnabled', (typeof defaultPrefs.dhtEnabled != 'undefined' ? (defaultPrefs.dhtEnabled ? 'true' : 'false') : 'false')) != 'false') }

exports.setDHTEnabled = function(isEnabled) { setPref('dhtEnabled', (isEnabled ? 'true' : 'false')) }

exports.updateStateFromSettings = function() {
  // Update the running state to match the stored settings.
  document.body.classList.add('theme-' + this.getTheme())
  for(var i = 0; i < document.body.classList.length; ++i) {
    const cur = document.body.classList.item(i)
    if(cur.substring(0, ('theme-').length) == 'theme-' && cur != 'theme-' + this.getTheme()) {
      document.body.classList.remove(cur)
      --i
    }
  }
}
