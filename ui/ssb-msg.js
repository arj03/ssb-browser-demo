const human = require('human-time')
const md = require('./markdown')

Vue.component('ssb-msg', {
  template: `
      <div class='message'>
        <div class='header'>
          <router-link :to="{name: 'profile', params: { feedId: msg.value.author }}">
            <img class='avatar' :src='imgURL' />
          </router-link>
          <span class='text'>
            <div class='date' :title='date'>{{ humandate }}</div>
            <router-link :to="{name: 'profile', params: { feedId: msg.value.author }}">{{ name }}</router-link> posted
            <span v-if="msg.value.content.root && msg.value.content.root != msg.key">
              in reply <router-link :to="{name: 'thread', params: { rootId: rootId }}">to</router-link>
            </span>
            <span v-else>
              a <router-link :to="{name: 'thread', params: { rootId: rootId }}">thread</router-link>
            </span>
          </span>
        </div>

        <h2 v-if="msg.value.content.subject">
          <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ msg.value.content.subject }}</router-link>
        </h2>

        <span v-html="body"></span>
        <span v-if="isOOO"><a href="javascript:void(0);" v-on:click="getOOO">get msg</a></span>
      </div>`,

  props: ['msg'],

  data: function() {
    return {
      imgURL: '',
      name: this.msg.value.author
    }
  },

  computed: {
    rootId: function() {
      if (this.msg.value.content.root)
        return this.msg.value.content.root.substring(1)
      else
        return this.msg.key.substring(1)
    },
    date: function() {
      return new Date(this.msg.value.timestamp).toLocaleString("da-DK")
    },
    humandate: function() {
      return human(new Date(this.msg.value.timestamp))
    },
    isOOO: function() {
      return this.msg.value.content.text == "Message outside follow graph" && !this.msg.value.author
    },
    body: function() {
      return md.markdown(this.msg.value.content.text)
    }
  },

  methods: {
    getOOO: function() {
      SSB.getOOO(this.msg.key, (err, msgValue) => {
        if (err) return alert("Failed to get msg " + err)
        this.msg = { key: this.msg.key, value: msgValue }
      })
    }
  },
  
  created: function () {
    if (SSB.profiles && !SSB.profiles[this.msg.value.author] && this.msg.value.author == SSB.net.id)
      this.name = "You"
    else if (SSB.profiles) {
      var profile = SSB.profiles[this.msg.value.author]
      if (profile) {
        this.name = profile.name
        if (profile.image) {
          var self = this
          SSB.net.blobs.localGet(profile.image, (err, url) => {
            if (!err)
              self.imgURL = url
          })
        }
      }
    }
  }
})
