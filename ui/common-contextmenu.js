Vue.component('common-contextmenu', {
  template: `
      <div>
        <vue-simple-context-menu :elementId="'commonContextMenu'+Math.floor(Math.random() * 9999999999)" @option-clicked="optionClicked" ref="internalContextMenu" :options="options" />
      </div>`,

  data: function() {
    return {
      options: []
    }
  },

  methods: {
    showMenu: function(event, options, context) {
      this.options = options
      this.$refs.internalContextMenu.showMenu(event, context)
    },

    optionClicked: function(event) {
      event.option.cb(event.item)
    }
  },

  created: function() {
  }
})
