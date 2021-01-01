const human = require('human-time')
const md = require('./markdown')

Vue.component('ssb-msg', {
  template: `
      <div class='message'>
        <div class='header'>
          <span class="profile">
            <ssb-profile-link v-bind:key="msg.value.author" v-bind:feedId="msg.value.author"></ssb-profile-link>
           </span>
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
          <span class='channel' v-if="msg.value.content.channel">
            <router-link :to="{name: 'channel', params: { channel: msg.value.content.channel }}">#{{ msg.value.content.channel }}</router-link>
          </span>
        </div>

        <h2 v-if="msg.value.content.subject">
          <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ msg.value.content.subject }}</router-link>
        </h2>

        <span v-html="body"></span>
        <span v-if="forks.length > 0"><b>Forks:</b>
          <li v-for="msg in forks">
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ msg.value.content.text.substring(0,50) }}</router-link>
          </li>
        </span>
        <span v-if="mentions.length > 0"><b>Mentions:</b>
          <li v-for="msg in mentions">
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ msg.value.content.text.substring(0,50) }}</router-link>
          </li>
        </span>
        <span v-if="reactions.length > 0"><b>Reactions:</b>
          <span v-for="reaction in reactions">
            <span v-bind:title="reaction.author">{{ reaction.expression }}</span>
          </span>
        </span>
        <span v-if="isOOO"><a href="javascript:void(0);" v-on:click="getOOO">get msg</a></span>
      </div>`,

  props: ['msg', 'thread'],

  data: function() {
    return {
      name: this.msg.value.author,
      forks: [],
      mentions: [],
      reactions: []
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

        if (net.db.getIndex('contacts').isBlocking(SSB.net.id, msgValue.author))
          this.msg.value.content.text = "Blocked user"
        else
          this.msg = { key: this.msg.key, value: msgValue }
      })
    }
  },
  
  created: function () {
    if (!this.msg.key) return

    const { and, votesFor, hasRoot, mentions, toCallback } = SSB.dbOperators

    function getName(profiles, author) {
      if (author == SSB.net.id)
        return "You"
      else if (profiles) {
        const profile = profiles[author]
        if (profile)
          return profile.name
      }
    }

    const profiles = SSB.db.getIndex('profiles').getProfiles()
    this.name = getName(profiles, this.msg.value.author)

    SSB.db.query(
      and(votesFor(this.msg.key)),
      toCallback((err, msgs) => {    
        const unlikes = msgs.filter(x => x.value.content.vote.expression == 'Unlike').map(x => { author: x.value.author })
        this.reactions = msgs.map(x => {
          const expression = x.value.content.vote.expression
          if (expression === 'Like') {
            if (unlikes.indexOf(x.value.author) == -1)
              return { author: getName(profiles, x.value.author), expression: '👍' }
          }
          else if (expression === 'dig') {
            if (unlikes.indexOf(x.value.author) == -1)
              return { author: getName(profiles, x.value.author), expression: '🖖' }
          }
          else
            return { author: getName(profiles, x.value.author), expression }
        })
      })
    )

    if (this.msg.key != this.thread) {
      SSB.db.query(
        and(hasRoot(this.msg.key)),
        toCallback((err, msgs) => {    
          this.forks = msgs.filter(m => m.value.content.type == 'post' && m.value.content.fork == this.msg.value.content.root)
        })
      )
    }

    SSB.db.query(
      and(mentions(this.msg.key)),
      toCallback((err, results) => {
        this.mentions = results
      })
    )
  }
})
