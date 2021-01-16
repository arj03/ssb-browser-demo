module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const { and, not, equal, isPublic, type, toCallback } = SSB.dbOperators
  const { seekChannel } = require('ssb-db2/seekers')

  return {
    template: `
    <div id="channels">
      <h2>Channels</h2>
      <ol>
        <li v-for="channel in channels">
          <router-link :to="{name: 'channel', params: { channel: channel }}">#{{ channel }}</router-link>
	</li>
      </ol>
    </div>`,

    data: function() {
      return {
        channels: []
      }
    },

    methods: {
      load: function() {
        document.body.classList.add('refreshing')

        console.time("channel list")
        
        SSB.db.query(
          and(not(equal(seekChannel, '', { indexType: 'value_content_type' }))),
          and(type('post')),
          and(isPublic()),
          toCallback((err, answer) => {
            if (!err) {
              for (r in answer) {
	        const channel = answer[r].value.content.channel;

                if (channel && channel != '' && channel != '"' && this.channels.indexOf(channel) < 0)
                  this.channels.push(channel)
              }
	      
              this.channels.sort();
            }

            document.body.classList.remove('refreshing')
            console.timeEnd("channel list")
          })
        )
      },
    },

    created: function () {
      this.load()
    }
  }
}
