module.exports = function () {
  const pull = require('pull-stream')

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
        SSB.db.jitdb.onReady(() => {
          SSB.db.jitdb.query({
            type: 'EQUAL',
            data: {
              seek: SSB.db.jitdb.seekChannel,
              value: this.channel,
              indexType: "channel"
            }
          }, 0, 50, (err, results) => {
            this.messages = results.filter(msg => !msg.value.meta)

            console.timeEnd("latest 50 channel messages")
          })
        })
      }
    },

    created: function () {
      this.render()
    },
  }
}
