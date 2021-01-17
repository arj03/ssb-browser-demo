const localPrefs = require('../localprefs')
const caps = require('ssb-caps')

module.exports = function () {
  const { and, mentions, toCallback } = SSB.dbOperators
  
  return {
    template: `
       <div id="channel">
         <h2>Settings</h2>
	 <p>
	 <label for="appTitle">App/browser tab title:</label><br />
	 <input type="text" id="appTitle" v-model="appTitle" placeholder="(Use default)" />
	 </p>

	 <p>
	 <label for="replicationHops">Number of hops to replicate:</label><br />
	 <select id="replicationHops" v-model="hops">
	 <option value="0">0 (only people you follow)</option>
	 <option value="1">1</option>
	 <option value="2">2</option>
	 <option value="3">3</option>
	 <option value="4">4</option>
	 <option value="5">5</option>
	 </select>
	 </p>

	 <p>
	 <label for="caps"><strong>ADVANCED</strong> - Caps key (leave blank to use default):</label><br />
	 <input type="text" id="caps" v-model="caps" placeholder="(Use default)" /><br />
	 <small>(Only change this if you really, really know what you're doing.)</small>
	 </p>

         <button class="clickButton" v-on:click="save()">Save</button>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        appTitle: '',
        caps: '',
        hops: 1
      }
    },

    methods: {
      render: function () {
        this.appTitle = localPrefs.getAppTitle()
        this.hops = localPrefs.getHops()
	this.caps = (localPrefs.getCaps() == caps.shs ? '' : localPrefs.getCaps())
      },

      save: function () {
        localPrefs.setAppTitle(this.appTitle)
        localPrefs.setHops(this.hops)
	localPrefs.setCaps(this.caps)
        localPrefs.updateStateFromSettings()

	alert("You may have to refresh your browser for these changes to take effect.");
      }
    },

    created: function () {
      this.render()
    },
  }
}
