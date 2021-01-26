const human = require('human-time')
const md = require('./markdown')
const helpers = require('./helpers')

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
              in reply to <router-link :to="{name: 'thread', params: { rootId: rootId }}">{{ parentThreadTitle }}</router-link>
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
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ smallText(msg) }}</router-link>
          </li>
        </span>
        <span v-if="mentions.length > 0"><b>Mentions:</b>
          <li v-for="msg in mentions">
            <router-link :to="{name: 'thread', params: { rootId: msg.key.substring(1) }}">{{ smallText(msg) }}</router-link>
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
              <a title='Remove reaction' href="javascript:void(0);" v-on:click="unlike()">{{ reaction.expression }}</a> 
            </span>
          </span>
          <span class='reactions-new' v-if="myReactions.length == 0">
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
      body: '',
      parentThreadTitle: this.$root.$t('ssb-msg.threadTitlePlaceholder'),
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
    }
  },

  methods: {
    smallText: function(msg) {
      if (msg.value.content && msg.value.content.text)
        return msg.value.content.text.substring(0,50)
      else
        return ''
    },
    getOOO: function() {
      SSB.getOOO(this.msg.key, (err, msgValue) => {
        if (err) return alert("Failed to get msg " + err)

        if (SSB.net.db.getIndex('contacts').isBlocking(SSB.net.id, msgValue.author))
          this.msg.value.content.text = "Blocked user"
        else
          this.msg = { key: this.msg.key, value: msgValue }
      })
    },
    react: function(emoji) {
      var voteValue = 1
      if (emoji == 'Unlike') {
        this.myReactions = []
        voteValue = 0
      } else
        this.myReactions.push({ expression: emoji })

      var reactTo = this.msg.key
      var message = {
        type: 'vote',
        vote: {
          link: reactTo,
          value: voteValue,
          expression: emoji
        }
      }

      SSB.db.publish(message, (err) => {
        if (err) console.log(err)
      })
    },
    unlike: function() {
      if (confirm("Are you sure you want to remove your reaction from this post?"))
        this.react('Unlike')
    }
  },
  
  created: function () {
    if (!this.msg.key) return

    const { and, votesFor, hasRoot, mentions, toCallback } = SSB.dbOperators

    var self = this

    if (this.msg.value.author == SSB.net.id)
      self.name = "You"
    else
      SSB.getProfileNameAsync(this.msg.value.author, (err, name) => {
        if(name)
          self.name = name
      })

    // Render the body, which may need to wait until we're connected to a peer.
    const blobRegEx = /!\[.*\]\(&.*\)/g
    if(self.msg.value.content.text && self.msg.value.content.text.match(blobRegEx)) {
      // It looks like it contains a blob.  There may be better ways to detect this, but this is a fast one.
      // We'll display a sanitized version of it until it loads.
      if(!SSB.isConnectedWithData())
        self.body = md.markdown(self.msg.value.content.text.replaceAll(blobRegEx, 'Loading...'))

      SSB.connectedWithData(() => {
        self.body = md.markdown(self.msg.value.content.text)
      })
    } else {
      self.body = md.markdown(this.msg.value.content.text)
    }

    SSB.db.query(
      and(votesFor(this.msg.key)),
      toCallback((err, msgs) => {    
        if (err) {
          console.log("Error getting votes: " + err)
          return
        }

        let authorToReaction = {}

        function isUnlike(msg) {
          return msg.value.content.vote.expression == 'Unlike' || msg.value.content.vote.value == 0
        }

        msgs.forEach(msg => {
          if (isUnlike(msg))
            delete authorToReaction[msg.value.author]
          else {
            let expression = msg.value.content.vote.expression
            if (expression === 'Like')
              expression = '👍'
            else if (expression === 'dig')
              expression = '🖖'
            else if (expression === 'heart')
              expression = '❤'

            authorToReaction[msg.value.author] = { author: msg.value.author, expression } // Pulling names for these has to be done async now, which is annoyingly complicated.  Since we hardly do anything with this right now anyway, just use the ID.
          }
        })

        this.reactions = Object.entries(authorToReaction).filter(([k,v]) => k != SSB.net.id).map(([k,v]) => v)
        this.myReactions = authorToReaction[SSB.net.id] ? [authorToReaction[SSB.net.id]] : []
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

    // If it's a reply to a thread, try to pull the thread title.
    if (this.msg.key != this.thread) {
      SSB.db.get(this.thread, (err, rootMsg) => {
        if (rootMsg) {
          var newTitle = helpers.getMessageTitle(self.thread, rootMsg)
          self.parentThreadTitle = (newTitle != self.thread ? newTitle : self.$root.$t('ssb-msg.threadTitlePlaceholder'))
        }
      })
    }

    SSB.db.query(
      and(mentions(this.msg.key)),
      toCallback((err, results) => {
        this.mentions = results
      })
    )
  }
})
