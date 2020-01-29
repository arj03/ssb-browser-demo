module.exports = function () {
  const pull = require('pull-stream')
  const helpers = require('./helpers')

  return {
    template: `
       <div id="channel">
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
        let contentFilter = { channel: this.channel }

        pull(
          SSB.db.query.read({
            reverse: true,
            limit: 50,
            query: [{
              $filter: {
                value: {
                  timestamp: { $gt: 0 },
                  content: contentFilter
                }
              }
            }]
          }),
          pull.filter((msg) => !msg.value.meta),
          pull.collect((err, msgs) => {
            this.messages = msgs
          })
        )
      }
    },

    created: function () {
      this.render()
    },
  }
}
