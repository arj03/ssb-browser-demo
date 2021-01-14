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
        <span v-if="isOOO"><a href="javascript:void(0);" v-on:click="getOOO">get msg</a></span>
        <div class='reactions'>
	  <span class='reactions-existing'>
            <span v-for="reaction in reactions">
              <span v-bind:title="reaction.author">{{ reaction.expression }}</span>
            </span>
	  </span>
	  <span class='reactions-mine' v-if="myReactions.length > 0">
	    <span v-for="reaction in myReactions">
	      <a href="javascript:void(0);" v-on:click="unlike()">{{ reaction.expression }}</a> 
	    </span>
	  </span>
	  <span class='reactions-new' v-if="myReactions.length <= 0">
	    <span class='reactions-label'>Add: </span>
	    <span v-for="emoji in emojiOptions">
	      <a href="javascript:void(0);" v-on:click="react(emoji)">{{ emoji }}</a> 
	    </span>
	  </span>
        </div>
      </div>`,

  props: ['msg', 'thread'],

  data: function() {
    return {
      name: this.msg.value.author,
      forks: [],
      mentions: [],
      reactions: [],
      myReactions: [],
      //emojiOptions: ['👍', '👎', '❤', '😄', '😃', '😁', '😆', '😅', '😂', '😉', '😋', '😝', '😐', '😒', '😎', '😧', '😖', '😣', '😞']
      emojiOptions: ['👍', '🖖', '❤']
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
    },
    react: function(emoji) {
      if(emoji == 'Unlike') {
	this.myReactions = [];
      } else {
        this.myReactions.push({ expression: emoji });
      }
      var reactTo = this.msg.key;
      var message = {
        type: 'vote',
	vote: {
	  link: reactTo,
	  value: 1,
	  expression: emoji
	}
      };
      SSB.db.publish(message, (err) => {
        if (err) console.log(err)
      })
    },
    unlike: function() {
      if(confirm("Are you sure you want to unlike this post?"))
      {
        this.react('Unlike');
      }
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
        if(err) {
	  console.log("Error getting votes: " + err);
	  return;
	}
        const unlikes = msgs.filter(x => x.value.content.vote.expression == 'Unlike').map(x => { return x.value.author })
        const allReactions = msgs.map(x => {
          const expression = x.value.content.vote.expression
	  if(unlikes.indexOf(x.value.author) >= 0)
	    return { unliked: true }

          if (expression === 'Like') {
            return { authorID: x.value.author, author: getName(profiles, x.value.author), expression: '👍' }
          }
          else if (expression === 'dig') {
            return { authorID: x.value.author, author: getName(profiles, x.value.author), expression: '🖖' }
          }
          else if (expression === 'heart') {
            return { authorID: x.value.author, author: getName(profiles, x.value.author), expression: '❤' }
          }
          else
            return { authorID: x.value.author, author: getName(profiles, x.value.author), expression }
        })
        this.reactions = allReactions.filter(x => !x.unliked && x.authorID != SSB.net.id);
	this.myReactions = allReactions.filter(x => !x.unliked && x.authorID == SSB.net.id);
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
