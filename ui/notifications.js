module.exports = function () {
  const { and, mentions, toCallback } = SSB.dbOperators
  
  return {
    template: `
       <div id="channel">
         <h2>{{ $t('notifications.title') }}</h2>
         <ssb-msg v-for="msg in messages" v-bind:key="msg.key" v-bind:msg="msg"></ssb-msg>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        messages: []
      }
    },

    methods: {
      render: function () {
        SSB.db.query(
          and(mentions(SSB.net.id)),
          toCallback((err, results) => {
            this.messages = results
          })
        )
      }
    },

    created: function () {
      this.render()
    },
  }
}
