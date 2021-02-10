const localPrefs = require('../localprefs')
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
require('ssb-browser-core/core').init("/.ssb-lite", optionsForCore);

(function() {
  const componentsState = require('./components')()
  const VueI18n = require('vue-i18n').default
  const i18nMessages = require('../messages.json')
  const helpers = require('./helpers')

  // Load local preferences.
  localPrefs.updateStateFromSettings();

  if ((location.hostname == 'localhost' || location.protocol === 'https:') && 'serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js');
    })
  }

  function ssbLoaded() {
    // Make sure settings have been applied.
    localPrefs.updateStateFromSettings();

    const Public = require('./public')(componentsState)
    const Profile = require('./profile')()
    const Notifications = require('./notifications')()
    const Channel = require('./channel')()
    const Group = require('./group')()
    const Channels = require('./channels')()
    const Groups = require('./groups')()
    const Thread = require('./thread')()
    const Private = require('./private')(componentsState)
    const Connections = require('./connections')()
    const Settings = require('./settings')()
    const Search = require('./search')()

    // add helper methods
    require('../net')
    require('../profile')
    require('../search')

    const routes = [
      { name: 'public', path: '/public', component: Public },
      { name: 'channels', path: '/channels', component: Channels },
      { name: 'groups', path: '/groups', component: Groups },
      { name: 'channel', path: '/channel/:channel', component: Channel, props: true },
      { name: 'group', path: '/group/:group', component: Group, props: true },
      { name: 'thread', path: '/thread/:rootId', component: Thread, props: true },
      { name: 'profile', path: '/profile/:feedId', component: Profile, props: true },
      { name: 'search', path: '/search/:search', component: Search, props: true },
      { name: 'notifications', path: '/notifications', component: Notifications },
      { path: '/private', component: Private },
      { name: 'private-feed', path: '/private/:feedId', component: Private, props: true },
      { path: '/connections', component: Connections },
      { path: '/settings', component: Settings },
      { path: '/', redirect: 'public' },
    ]

    const router = new VueRouter({
      routes
    })

    var defaultLocale = (navigator.language || (navigator.languages ? navigator.languages[0] : navigator.browserLanguage ? navigator.browserLanguage : null))
    var localePref = localPrefs.getLocale()
    if(localePref && localePref != '')
      defaultLocale = localePref
    if (!i18nMessages[defaultLocale])
      defaultLocale = 'en'
    const i18n = new VueI18n({
      locale: defaultLocale,
      fallbackLocale: 'en',
      silentFallbackWarn: true,
      messages: i18nMessages
    })

    // Just in case a tab doesn't set this.
    document.title = localPrefs.getAppTitle()

    const app = new Vue({
      router,

      i18n,

      data: function() {
        return {
          appTitle: localPrefs.getAppTitle(),
          suggestions: [],
          goToTargetText: ""
        }
      },

      methods: {
        targetFocus: function() {
          document.getElementById("searchBox").className = "expanded"
        },

        targetBlur: function() {
          document.getElementById("searchBox").className = ""
        },

        suggestTarget: function() {
          if (this.goToTargetText.startsWith('@')) {
            const profiles = SSB.searchProfiles(this.goToTargetText.substring(1), 5)
            // For consistency with the Markdown editor.
            const newSuggestions = profiles.map((x) => { return { type: "profile", id: x.id, text: "@" + x.name, icon: x.imageURL || helpers.getMissingProfileImage() }})
            this.suggestions = newSuggestions
          } else if (this.goToTargetText.startsWith('#')) {
            const searchForChannel = this.goToTargetText.substring(1)
            const allChannels = SSB.db.getIndex("channels").getChannels()
            const sortFunc = (new Intl.Collator()).compare
            const filteredChannels = allChannels.filter((x) => { return x.toLowerCase().startsWith(searchForChannel.toLowerCase()) })
              .sort(sortFunc)
              .slice(0, 5)
            var newSuggestions = []
            for (c in filteredChannels)
              newSuggestions.push({ type: "channel", text: "#" + filteredChannels[c], value: filteredChannels[c] })
            this.suggestions = newSuggestions
          } else {
            this.suggestions = []
          }
        },

        useSuggestion: function(suggestion) {
          this.goToTargetText = suggestion.text
          this.goToTarget()
        },

        goToTarget: function() {
          if (this.goToTargetText != '' && this.goToTargetText.startsWith('%')) {
            router.push({ name: 'thread', params: { rootId: this.goToTargetText.substring(1) } })
            this.goToTargetText = ""
            this.suggestions = []
          } else if (this.goToTargetText != '' && this.goToTargetText.startsWith('#')) {
            const searchForChannel = this.goToTargetText.substring(1)
            const allChannels = SSB.db.getIndex("channels").getChannels()
            if (allChannels.indexOf(this.goToTargetText.substring(1)) < 0 && this.suggestions.length > 0)
              this.goToTargetText = this.suggestions[0].text
            router.push({ name: 'channel', params: { channel: this.goToTargetText.substring(1) } })
            this.goToTargetText = ""
            this.suggestions = []
          } else if (this.goToTargetText != '' && this.goToTargetText.startsWith('@')) {
            // If it's not a valid profile ID, try doing a text search.
            const profiles = SSB.db.getIndex("profiles")
            const profile = profiles.getProfile(this.goToTargetText)
            if (!profile || Object.keys(profile).length == 0) {
              // We could use searchProfiles here, but this gives us a little more exact results in case the user skipped the suggestions.
              const profilesDict = profiles.getProfiles()
              const searchText = this.goToTargetText.substring(1)
              var exactMatch = null
              var caselessMatch = null
              var similar = null
              for (p in profilesDict) {
                if (profilesDict[p].name == searchText) {
                  exactMatch = p
                  break
                } else if (!caselessMatch && profilesDict[p].name && profilesDict[p].name.toLowerCase() == searchText.toLowerCase()) {
                  caselessMatch = p
                } else if (!similar && profilesDict[p].name && profilesDict[p].name.toLowerCase().startsWith(searchText.toLowerCase())) {
                  similar = p
                }
              }
              this.goToTargetText = (exactMatch || caselessMatch || similar || this.goToTargetText)
              if (!exactMatch && !caselessMatch && !similar)
                alert(this.$root.$t('common.unableToFindProfile'))
            }

            router.push({ name: 'profile', params: { feedId: this.goToTargetText } })
            this.goToTargetText = ""
            this.suggestions = []
          } else {
            router.push({ name: 'search', params: { search: this.goToTargetText } })
            this.goToTargetText = ""
            this.suggestions = []
          }
        }
      }

    }).$mount('#app')
  }

  if (SSB.events._events["SSB: loaded"])
    ssbLoaded()
  else
    SSB.events.once('SSB: loaded', ssbLoaded)
})()
