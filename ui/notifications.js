module.exports = function () {
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
        SSB.db.getMessagesByMention(SSB.net.id, (err, msgs) => {
          this.messages = msgs
        })
      }
    },

    created: function () {
      this.render()
    },
  }
}
