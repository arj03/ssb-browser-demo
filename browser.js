(function() {
  const pull = require('pull-stream')
  
  // FIXME: move these two into their own two modules
  
  function newMessagesNotify() {
    pull(
      SSB.db.query.read({
        live: true,
        old: false,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              content: { type: 'post' }
            }
          }
        }]
      }),
      pull.filter((msg) => !msg.value.meta),
      pull.drain(() => {
        document.getElementById("newPublicMessages").innerHTML = "&#127881;"
      })
    )
  }

  function newPrivateMessagesNotify() {
    pull(
      SSB.db.query.read({
        live: true,
        old: false,
        query: [{
          $filter: {
            value: {
              timestamp: { $gt: 0 },
              content: { type: 'post', recps: { $truthy: true } }
            }
          }
        }]
      }),
      pull.drain(() => {
        document.getElementById("newPrivateMessages").innerHTML = "&#128274;"
      })
    )
  }

  SSB.events.on('SSB: loaded', function() {
    const Public = require('./ui/public')()
    const Profile = require('./ui/profile')()
    const Thread = require('./ui/thread')()
    const Private = require('./ui/private')()
    const Chat = require('./ui/chat')()
    const Settings = require('./ui/settings')()

    if (localStorage['settings']) {
      var settings = JSON.parse(localStorage['settings'])
      SSB.remoteAddress = settings.remoteAddress
    } else
      SSB.remoteAddress = Settings.data().remoteAddress

    SSB.loadProfiles()

    newMessagesNotify()
    newPrivateMessagesNotify()

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
            router.push({ path: 'thread', params: { messageId: this.goToTargetText } })
            this.goToTargetText = ""
          } else if (this.goToTargetText != '' && this.goToTargetText.startsWith('@')) {
            router.push({ path: 'profile', params: { feedId: this.goToTargetText } })
            this.goToTargetText = ""
          }
        }
      }

    }).$mount('#app')
  })
})()
