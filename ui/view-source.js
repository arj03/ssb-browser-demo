Vue.component('view-source', {
  template: `
        <transition name="modal" v-if="show">
          <div class="modal-mask">
            <div class="modal-wrapper">
              <div class="modal-container">
                <h3>View Source</h3>
                <div class="modal-body" v-html="sourceHtml"></div>

                <div class="modal-footer">
                  <button class="clickButton" @click="onClose">
                    {{ $t('common.close') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>`,

  props: ['sourceHtml', 'onClose', 'show'],
})
