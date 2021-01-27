module.exports = function () {
  require('./ssb-profile-link')
  require('./ssb-msg')
  require('./ssb-msg-preview')
  require('./onboarding-dialog')
  require('./connected')
  const { Editor } = require('@toast-ui/vue-editor')

  Vue.component('v-select', VueSelect.VueSelect)
  Vue.component('editor', Editor)

  const state = {
    newPublicMessages: false,
    newPrivateMessages: false
  }

  require('./new-public-messages')(state)
  require('./new-private-messages')(state)

  return state
}
