(function() {
  const pull = require('pull-stream')
  
  SSB.events.on('SSB: loaded', function() {
    const Public = require('./public')()
    const Profile = require('./profile')()
    const Thread = require('./thread')()
    const Private = require('./private')()
    const Chat = require('./chat')()
    const Settings = require('./settings')()

    if (localStorage['settings']) {
      var settings = JSON.parse(localStorage['settings'])
      SSB.remoteAddress = settings.remoteAddress
    } else
      SSB.remoteAddress = Settings.data().remoteAddress

    SSB.loadProfiles()

    const routes = [
      { path: '/public', component: Public },
      { name: 'thread', path: '/thread/:rootId', component: Thread, props: true },
      { name: 'profile', path: '/profile/:feedId', component: Profile, props: true },
      { path: '/private', component: Private },
      { path: '/chat', component: Chat },
      { path: '/settings', component: Settings }
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
  })
})()
