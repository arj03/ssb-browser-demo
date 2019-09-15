const nodeEmoji = require('node-emoji')
const md = require('ssb-markdown')
const ref = require('ssb-ref')
const human = require('human-time')

const mdOpts = {
  toUrl: (id) => {
    var link = ref.parseLink(id)
    if (link && ref.isBlob(link.link))
    {
      if (link.query && link.query.unbox) // private
      {
        // FIXME: doesn't work the first time
        SSB.net.blobs.privateGet(link.link, link.query.unbox, () => {})
        return SSB.net.blobs.privateFsURL(link.link)
      }
      else
        return SSB.net.blobs.remoteURL(link.link)
    }
    else
      return id
  },
  emoji: (emoji) => {
    // https://github.com/omnidan/node-emoji/issues/76
    const emojiCharacter = nodeEmoji.get(emoji).replace(/:/g, '')
    return `<span class="Emoji">${emojiCharacter}</span>`
  }
}

Vue.component('ssb-msg', {
  template: `
      <div class='message'>
        <div class='header'>
          <img class='avatar' :src='imgURL' />
          <span class='text'>
            <div class='date' :title='date'>{{ humandate }}</div>
            <a :href='msg.value.author'>{{ name }}</a> posted <span v-html="postType"></span>
          </span>
        </div>

        <h2 v:if="msg.value.content.subject">
          <a :href='msg.key'>{{ msg.value.content.subject }}</a>
        </h2>

        <span v-html="body"></span>
      </div>`,

  props: ['msg'],

  data: function() {
    return {
      imgURL: '',
      name: this.msg.value.author
    }
  },

  computed: {
    date: function() {
      return new Date(this.msg.value.timestamp).toLocaleString("da-DK")
    },
    humandate: function() {
      return human(new Date(this.msg.value.timestamp))
    },
    postType: function() {
      if (this.msg.value.content.root && this.msg.value.content.root != this.msg.key)
        return ` in reply <a href='${this.msg.value.content.root}'>to</a>`
      else
        return ` a <a href='${this.msg.key}'>thread</a>`
    },
    body: function() {
      return md.block(this.msg.value.content.text, mdOpts)
    }
  },
  
  created: function () {
    if (this.msg.value.author == SSB.net.id)
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
