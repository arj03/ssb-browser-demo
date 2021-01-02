module.exports = function () {
  const pull = require('pull-stream')
  const { and, channel, isNotPrivate, startFrom, paginate, toCallback } = SSB.dbOperators

  return {
    template: `
       <div id="channel">
         <h2>Channel #{{ channel }}</h2>
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
        console.time("latest 50 channel messages")

        SSB.db.query(
          and(channel(this.channel), isNotPrivate()),
          startFrom(this.offset),
          paginate(50),
          toCallback((err, answer) => {
            this.messages = answer.results

            console.timeEnd("latest 50 channel messages")
          })
        )
      }
    },

    created: function () {
      this.render()
    },
  }
}
