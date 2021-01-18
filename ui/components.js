module.exports = function () {
  require('./ssb-profile-link')
  require('./ssb-msg')
  require('./ssb-msg-preview')
  require('./onboarding-dialog')
  require('./connected')

  Vue.component('v-select', VueSelect.VueSelect)

  const state = {
    newPublicMessages: false,
    newPrivateMessages: false
  }

  require('./new-public-messages')(state)
  require('./new-private-messages')(state)

  return state
}
