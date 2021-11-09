const defaultPrefs = require("../defaultprefs.json")
const helpers = require('./helpers')

Vue.component('onboarding-dialog', {
  template: `
        <transition name="modal" v-if="show">
          <div id="onboarding-dialog" class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <p v-html="$t('onboarding.welcomeMessage')"></p>

                <tabs :onSelect="changeTab">
                  <tab :title="$t('onboarding.newUser')"><div class="tab-clear-margin">&nbsp;</div>
                    <p>
                      <label for="name">{{ $t('onboarding.profileName') }}</label><br />
                      <input type="text" v-model="name" id="name" :placeholder="$t('onboarding.profileNamePlaceholder')" />
                    </p>
  
                    <hr />
  
                    <p>
                      <label for="descriptionText">{{ $t('onboarding.profileDescription') }}</label><br />
                      <markdown-editor id="descriptionText" :placeholder="$t('onboarding.profileDescriptionPlaceholder')" :initialValue="descriptionText" ref="markdownEditor" />
                    </p>
  
                    <div v-if="suggestedFollows.length > 0">
                      <hr />
                      <p>{{ $t('onboarding.suggestedFollows') }}<br />
                        <div v-for="(follow, index) in suggestedFollows">
                          <input type="checkbox" :id="'follow' + index" :value="follow" v-model="useFollows" />&nbsp;<label :for="'follow' + index">{{ follow.name }}</label>
                        </div>
                      </p>
                    </div>
                  </tab>
                  <tab :title="$t('onboarding.recoverExistingAccount')"><div class="tab-clear-margin">&nbsp;</div>
                    <p><label for="mnemonic">{{ $t('onboarding.mnemonicInstructions') }}</label></p>
                    <textarea id="mnemonic" :placeholder="$t('profile.enterMnemonicCodePlaceholder')" v-model="mnemonic" rows="6" cols="60"></textarea>
                  </tab>
                </tabs>
                <div v-if="displayRecoveryWarnings">
                  <!-- It'd be great it we could put this inside of the tab, but if you do, it crashes when you switch back to the New User tab.  So these are here instead. -->
                  <p class="warning"><strong>{{ $t('common.warning') }}</strong> {{ $t('onboarding.warningSingleDevice') }}</p>
                  <p class="note"><strong>{{ $t('common.note') }}</strong> {{ $t('onboarding.noteConnectToSync') }}</p>
                </div>

                <div v-if="suggestedPeers.length > 0">
                <p>{{ $t('onboarding.suggestedPeers') }}<br />
                <div v-for="(peer, index) in suggestedPeers">
                  <input type="checkbox" :id="'peer' + index" :value="peer" v-model="usePeers" />&nbsp;<label :for="'peer' + index">{{ peer.name }}</label>
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
      mnemonic: '',
      displayRecoveryWarnings: false,
      currentTab: 0,
      suggestedPeers: (defaultPrefs.suggestPeers || []),
      suggestedFollows: (defaultPrefs.suggestFollows || []),
      usePeers: (defaultPrefs.suggestPeers || []).filter((x) => typeof x.default == "undefined" || x.default),
      useFollows: (defaultPrefs.suggestFollows || []).filter((x) => typeof x.default == "undefined" || x.default)
    }
  },

  methods: {
    changeTab: function(e, index) {
      this.currentTab = index
      this.displayRecoveryWarnings = (index == 1)
    },

    saveProfile: function() {
      this.descriptionText = this.$refs.markdownEditor.getMarkdown()

      var msg = { type: 'about', about: SSB.id }
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
      if (this.currentTab == 0) {
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
            SSB.helpers.connectAndRemember(suggestedPeer.address, {
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
      } else {
        // Recover account from existing mnemonic code.
        const mnemonic = require('ssb-keys-mnemonic')
        const key = mnemonic.wordsToKeys(this.mnemonic)
        localStorage["/.ssb-lite/secret"] = JSON.stringify(key)
        localStorage["/.ssb-lite/restoreFeed"] = "true"

        // Remember connections for after the reload.
        // This is different than under the New User case because we don't want to wait for a successful connection to remember the connection - otherwise reloading means it never gets saved.
        for (p in this.usePeers) {
          (function(x) {
            const suggestedPeer = x
            var s = suggestedPeer.address.split(":")
            SSB.conn.remember(suggestedPeer.address, {
              key: '@' + s[s.length-1] + '.ed25519',
              type: suggestedPeer.type,
              autoconnect: true
            })
          })(this.usePeers[p])
        }

        // Since we recovered a mnemonic code, warn the user we'll need to refresh and then do it so the new key takes effect.
        alert("We will now need to reload for this change to take effect.")
        window.location.reload()
      }

      this.onClose()
    }
  },

  computed: {
  }
})
