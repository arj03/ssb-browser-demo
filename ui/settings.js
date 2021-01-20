const localPrefs = require('../localprefs')
const caps = require('ssb-caps')

module.exports = function () {
  const { and, mentions, toCallback } = SSB.dbOperators
  
  return {
    template: `
       <div id="channel">
         <h2>{{ $t('settings.title') }}</h2>
	 <p>
	 <label for="appTitle">{{ $t('settings.appTitle') }}</label><br />
	 <input type="text" id="appTitle" v-model="appTitle" :placeholder="$t('settings.appTitlePlaceholder')" />
	 </p>

         <p>
         <label for="theme">{{ $t('settings.colorTheme') }}</label><br />
         <select id="theme" v-model="theme">
         <option value="default">Default</option>
         <option value="dark">Dark</option>
         <option value="ethereal">Ethereal</option>
	 <option value="seigaihasubtle">Seigaiha Subtle</option>
         <option value="floralgardenbird">Floral Garden Bird</option>
         </select>
         </p>

	 <p>
	 <label for="replicationHops">{{ $t('settings.replicateHops') }}</label><br />
	 <select id="replicationHops" v-model="hops">
	 <option value="0">0 {{ $t('settings.directFollows') }}</option>
	 <option value="1">1</option>
	 <option value="2">2</option>
	 <option value="3">3</option>
	 <option value="4">4</option>
	 <option value="5">5</option>
	 </select>
	 </p>

	 <p>
	 <label for="caps"><strong>{{ $t('settings.advanced') }}</strong> - {{ $t('settings.capsKey') }}</label><br />
	 <input type="text" id="caps" v-model="caps" :placeholder="$t('settings.capsKeyPlaceholder')" /><br />
	 <small>{{ $t('settings.capsKeyWarning') }}</small>
	 </p>

         <button class="clickButton" v-on:click="save()">{{ $t('common.save') }}</button>
       <div>`,

    props: ['channel'],
    
    data: function() {
      return {
        appTitle: '',
        theme: 'default',
        caps: '',
        hops: 1
      }
    },

    methods: {
      render: function () {
        this.appTitle = localPrefs.getAppTitle()
        this.theme = localPrefs.getTheme()
        this.hops = localPrefs.getHops()
	this.caps = (localPrefs.getCaps() == caps.shs ? '' : localPrefs.getCaps())
      },

      save: function () {
        localPrefs.setAppTitle(this.appTitle)
        localPrefs.setTheme(this.theme)
        localPrefs.setHops(this.hops)
	localPrefs.setCaps(this.caps)
        localPrefs.updateStateFromSettings()

	alert(this.$root.$t('settings.refreshForChanges'));
      }
    },

    created: function () {
      this.render()
    },
  }
}
