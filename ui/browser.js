(function() {
  const componentsState = require('./components')()

  if ((location.hostname == 'localhost' || location.protocol === 'https:') && 'serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js');
    })
  }

  function ssbLoaded() {
    const Public = require('./public')(componentsState)
    const Profile = require('./profile')()
    const Notifications = require('./notifications')()
    const Channel = require('./channel')()
    const Thread = require('./thread')()
    const Private = require('./private')(componentsState)
    const Connections = require('./connections')()

    // add helper methods
    require('../net')

    const routes = [
      { name: 'public', path: '/public', component: Public },
      { name: 'channel', path: '/channel/:channel', component: Channel, props: true },
      { name: 'thread', path: '/thread/:rootId', component: Thread, props: true },
      { name: 'profile', path: '/profile/:feedId', component: Profile, props: true },
      { name: 'notifications', path: '/notifications', component: Notifications },
      { path: '/private', component: Private },
      { path: '/connections', component: Connections },
      { path: '/', redirect: 'public' },
    ]

    const router = new VueRouter({
      routes
    })

    const app = new Vue({
      router,

      data: function() {
        return {
          goToTargetText: ""
        }
      },

      methods: {
        goToTarget: function() {
          if (this.goToTargetText != '' && this.goToTargetText.startsWith('%')) {
            router.push({ name: 'thread', params: { rootId: this.goToTargetText.substring(1) } })
            this.goToTargetText = ""
          } else if (this.goToTargetText != '' && this.goToTargetText.startsWith('@')) {
            router.push({ name: 'profile', params: { feedId: this.goToTargetText } })
            this.goToTargetText = ""
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
