module.exports = function () {
  const pull = require('pull-stream')

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
        const query = [{
          $filter: {
            dest: SSB.net.id,
            timestamp: { $gt: 0 }
          }
        }, {
          $filter: {
            value: {
              author: { $ne: SSB.net.id } // not my messages!
              // NOTE putting this in second filter might be necessary to stop index trying to use this author value
            }
          }
        }]

        pull(
          SSB.db.backlinks.read({
            reverse: true,
            limit: 50,
            index: 'DTA',
            query
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
