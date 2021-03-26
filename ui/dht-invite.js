Vue.component('dht-invite', {
  template: `
        <transition name="modal" v-if="show">
          <div class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <h3>Create invite</h3>
                <textarea rows="8" cols="40" class="modal-body" v-html="inviteCodeDisplay"></textarea>
		<p>To link up with someone else directly over DHT (without a room or a pub), copy this invite code and send it to your friend.  Not all SSB clients support DHT invites, but if they do, they can accept this invite to link up.</p>

                <div class="modal-footer">
                  <button class="clickButton" @click="onClose">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>`,

  props: ['inviteCode', 'onClose', 'show'],

  computed: {
    inviteCodeDisplay: function() {
      if (this.show)
        return this.inviteCode
      else
        return ""
    }
  }
})
