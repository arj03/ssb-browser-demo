const defaultPrefs = require("../defaultprefs.json")

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
                <editor id="descriptionText" :placeholder="$t('onboarding.profileDescriptionPlaceholder')" usageStatistics="false" :initialValue="descriptionText" initialEditType="wysiwyg" ref="tuiEditor" />

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
      this.descriptionText = this.$refs.tuiEditor.invoke('getMarkdown')

      var msg = { type: 'about', about: SSB.net.id }
      if (this.name)
        msg.name = this.name
      if (this.descriptionText)
        msg.description = this.descriptionText

      SSB.db.publish(msg, (err) => {
        if (err) return alert(err)
      })
    },

    getStarted: function() {
      // Save the person's name and description.
      this.saveProfile()

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
          }, () => {
            // wait for db sync
            SSB.connectedWithData(() => {
              SSB.db.getIndex('contacts').getGraphForFeed(SSB.net.id, () => SSB.net.sync(SSB.getPeer()))
            })
          })
        })(this.useFollows[f].key)
      }

      this.onClose()
    }
  },

  computed: {
  }
})
