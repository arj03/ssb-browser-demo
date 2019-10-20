const md = require('./markdown')

Vue.component('ssb-msg-preview', {
  template: `
        <transition name="modal" v-if="show">
          <div class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <h3>Post preview</h3>
                <div class="modal-body" v-html="msgPreview"></div>

                <div class="modal-footer">
                  <button class="clickButton" @click="onClose">
                    Close
                  </button>
                  <button class="modal-default-button clickButton" v-on:click="confirmPost">
                    Post message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>`,

  props: ['text', 'onClose', 'confirmPost', 'show'],

  computed: {
    msgPreview: function() {
      if (this.show)
        return md.markdown(this.text)
      else
        return ""
    }
  }
})
