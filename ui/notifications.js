module.exports = function () {
  const { and, toCallback } = require('ssb-db2/operators')  
  const mentions = require('ssb-db2/operators/full-mentions')
  
  return {
    template: `
       <div id="channel">
         <h2>Notifications</h2>
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
          toCallback((err, answer) => {
            this.messages = answer.results
          })
        )
      }
    },

    created: function () {
      this.render()
    },
  }
}
