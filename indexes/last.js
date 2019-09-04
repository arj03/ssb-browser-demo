// this is a bit special because we don't store all messages we receive
const validate = require('ssb-validate')

module.exports = function () {
  var state = {}
  var writer = null;

  function load() {
    if (localStorage['last.json'])
      state = JSON.parse(localStorage['last.json'])
  }

  function save() {
    if (!writer) {
      writer = setTimeout(() => {
        writer = null
        localStorage['last.json'] = JSON.stringify(state)
      }, 1000)
    }
  }

  return {
    setPartialLog: function(author) {
      if (state[author].partial !== true) {
        state[author].partial = true
        save()
      }
    },

    update: function(msg) {
      state[msg.author] = {
        id: validate.id(msg),
        timestamp: msg.timestamp,
        sequence: msg.sequence,
        partial: state[msg.author] && state[msg.author].partial
      }

      save()
    },

    get: function() {
      if (Object.keys(state).length == 0)
        load()
      return state
    },

    load
  }
}
