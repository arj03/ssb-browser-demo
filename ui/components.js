module.exports = function () {
  require('./ssb-profile-link')
  require('./ssb-msg')
  require('./ssb-msg-preview')
  require('./onboarding-dialog')
  require('./link-contextmenu')
  require('./connected')
  const { Editor } = require('@toast-ui/vue-editor')
  const { VueSimpleContextMenu } = require("vue-simple-context-menu")
  require('./markdown-editor')

  Vue.component('v-select', VueSelect.VueSelect)
  Vue.component('vue-simple-context-menu', VueSimpleContextMenu)
  Vue.component('tui-editor', Editor)

  const state = {
    publicRefreshTimer: 0,
    newPublicMessages: false,
    newPrivateMessages: false
  }

  require('./new-public-messages')(state)
  require('./new-private-messages')(state)

  return state
}
