const defaultPrefs = require("../defaultprefs.json")

Vue.component('onboarding-dialog', {
  template: `
        <transition name="modal" v-if="show">
          <div id="onboarding-dialog" class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <h3>New user</h3>
		<p>Welcome!  It looks like you're new here.  All of this informataion is <strong>entirely optional</strong>, but it does tend to help get you up and running quickly and easily.</p>

		<hr />

		<p><label for="name">Pick a name for yourself (you can change this later under Profile):</label><br />
		<input type="text" v-model="name" id="name" placeholder="(Your name/nickname)" /></p>

		<hr />

		<p><label for="descriptionText">If you want, you can type up a short bio:</label><br />
		<textarea cols="40" rows="6" id="descriptionText" v-model="descriptionText" placeholder="(A short bio about you - Markdown formatting is supported)"></textarea></p>

                <div v-if="suggestedPeers.length > 0">
		<hr />
		<p>Here are some preset servers you can connect to:<br />
                <div v-for="(peer, index) in suggestedPeers">
                  <input type="checkbox" :id="'peer' + index" :value="peer" v-model="usePeers" />&nbsp;<label :for="'peer' + index">{{ peer.name }}</label>
                </div>
		</p>
                </div>

                <div v-if="suggestedFollows.length > 0">
		<hr />
		<p>And here are some people you might like to follow:<br />
                <div v-for="(follow, index) in suggestedFollows">
                  <input type="checkbox" :id="'follow' + index" :value="follow" v-model="useFollows" />&nbsp;<label :for="'follow' + index">{{ follow.name }}</label>
                </div>
		</p>
                </div>

                <div class="modal-footer">
                  <button class="clickButton" @click="onClose">
                    Cancel - Manual setup
                  </button>
                  <button class="modal-default-button clickButton get-started-button" v-on:click="getStarted">
                    Get started!
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
