const defaultPrefs = require("../defaultprefs.json")
const helpers = require('./helpers')

Vue.component('onboarding-dialog', {
  template: `
        <transition name="modal" v-if="show">
          <div id="onboarding-dialog" class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <h3>{{ $t('onboarding.title') }}</h3>
                <p v-html="$t('onboarding.welcomeMessage')"></p>

                <hr />

                <p><label for="name">{{ $t('onboarding.profileName') }}</label><br />
                <input type="text" v-model="name" id="name" :placeholder="$t('onboarding.profileNamePlaceholder')" /></p>

                <hr />

                <p><label for="descriptionText">{{ $t('onboarding.profileDescription') }}</label><br />
                <markdown-editor id="descriptionText" :placeholder="$t('onboarding.profileDescriptionPlaceholder')" :initialValue="descriptionText" ref="markdownEditor" />

                <div v-if="suggestedPeers.length > 0">
                <hr />
                <p>{{ $t('onboarding.suggestedPeers') }}<br />
                <div v-for="(peer, index) in suggestedPeers">
                  <input type="checkbox" :id="'peer' + index" :value="peer" v-model="usePeers" />&nbsp;<label :for="'peer' + index">{{ peer.name }}</label>
                </div>
                </p>
                </div>

                <div v-if="suggestedFollows.length > 0">
                <hr />
                <p>{{ $t('onboarding.suggestedFollows') }}<br />
                <div v-for="(follow, index) in suggestedFollows">
                  <input type="checkbox" :id="'follow' + index" :value="follow" v-model="useFollows" />&nbsp;<label :for="'follow' + index">{{ follow.name }}</label>
                </div>
                </p>
                </div>

                <div class="modal-footer">
                  <button class="clickButton" @click="onClose">
                    {{ $t('onboarding.manualSetup') }}
                  </button>
                  <button class="modal-default-button clickButton get-started-button" v-on:click="getStarted">
                    {{ $t('onboarding.getStarted') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>`,

  props: ['onClose', 'show'],

  data: function() {
    var self = this
    return {
      name: '',
      descriptionText: '',
      suggestedPeers: (defaultPrefs.suggestPeers || []),
      suggestedFollows: (defaultPrefs.suggestFollows || []),
      usePeers: (defaultPrefs.suggestPeers || []).filter((x) => typeof x.default == "undefined" || x.default),
      useFollows: (defaultPrefs.suggestFollows || []).filter((x) => typeof x.default == "undefined" || x.default)
    }
  },

  methods: {
    saveProfile: function() {
      this.descriptionText = this.$refs.markdownEditor.getMarkdown()

      var msg = { type: 'about', about: SSB.net.id }
      if (this.name)
        msg.name = this.name
      if (this.descriptionText)
        msg.description = this.descriptionText

      // Make sure the full post (including headers) is not larger than the 8KiB limit.
      if (JSON.stringify(msg).length > 8192) {
        throw this.$root.$t('common.postTooLarge')
      }

      SSB.db.publish(msg, (err) => {
        if (err) throw err
      })
    },

    getStarted: function() {
      // Save the person's name and description.
      try {
        this.saveProfile()
      } catch(err) {
        alert(err)
        return
      }

      // Connect to peers.
      for (p in this.usePeers) {
        (function(x) {
          const suggestedPeer = x
          var s = suggestedPeer.address.split(":")
          SSB.net.connectAndRemember(suggestedPeer.address, {
            key: '@' + s[s.length-1] + '.ed25519',
            type: suggestedPeer.type
          })
        })(this.usePeers[p])
      }

      // Follow people.
      for (f in this.useFollows) {
        (function(x) {
          const followKey = x
          SSB.db.publish({
            type: 'contact',
            contact: followKey,
            following: true
          }, () => { })
        })(this.useFollows[f].key)
      }

      this.onClose()
    }
  },

  computed: {
  }
})
