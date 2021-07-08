module.exports = function () {
  require('./ssb-profile-link')
  require('./ssb-profile-name-link')
  require('./ssb-msg')
  require('./ssb-msg-preview')
  require('./dht-invite')
  require('./onboarding-dialog')
  require('./common-contextmenu')
  require('./view-source')
  require('./connected')
  const { Editor } = require('@toast-ui/vue-editor')
  const { VueSimpleContextMenu } = require("vue-simple-context-menu")
  const { Tabs, Tab } = require("vue-slim-tabs")
  require('./markdown-editor')

  Vue.component('v-select', VueSelect.VueSelect)
  Vue.component('vue-simple-context-menu', VueSimpleContextMenu)
  Vue.component('tui-editor', Editor)
  Vue.component('tabs', Tabs)
  Vue.component('tab', Tab)

  const state = {
    publicRefreshTimer: 0,
    newPublicMessages: false,
    newPrivateMessages: false
  }

  require('./new-public-messages')(state)
  require('./new-private-messages')(state)

  return state
}
