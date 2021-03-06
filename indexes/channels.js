const bipf = require('bipf')
const pull = require('pull-stream')
const pl = require('pull-level')
const Plugin = require('ssb-db2/indexes/plugin')

const bValue = Buffer.from('value')
const bContent = Buffer.from('content')
const bType = Buffer.from('type')
const bChannel = Buffer.from('channel')
const bPost = Buffer.from('post')

module.exports = class Channel extends Plugin {
  constructor(log, dir) {
    super(log, dir, 'channels', 2, undefined, 'json')
    this.channels = {}
  }

  processRecord(record, processed) {
    const recBuffer = record.value
    if (!recBuffer) return // deleted

    let p = 0 // note you pass in p!
    p = bipf.seekKey(recBuffer, p, bValue)
    if (p < 0) return

    const pContent = bipf.seekKey(recBuffer, p, bContent)
    if (pContent < 0) return

    const pType = bipf.seekKey(recBuffer, pContent, bType)
    if (pType < 0) return

    if (bipf.compareString(recBuffer, pType, bPost) === 0) {
      const pChannel = bipf.seekKey(recBuffer, pContent, bChannel)
      if (pChannel < 0) return

      let channel = bipf.decode(recBuffer, pChannel)
      if (!channel || channel == '') return
      channel = channel.replace(/^[#]+/, '')

      if (!this.channels[channel])
        this.channels[channel] = { id: channel, count: 0 }
      ++this.channels[channel].count

      this.batch.push({
        type: 'put',
        key: channel,
        value: this.channels[channel]
      })
    }
  }
  
  onLoaded(cb) {
    console.time("start channels get")
    pull(
      pl.read(this.level, {
        gte: '',
        lte: undefined,
        keyEncoding: this.keyEncoding,
        valueEncoding: this.valueEncoding,
        keys: true
      }),
      pull.drain(
        (data) => this.channels[data.key] = data.value,
        () => {
          console.timeEnd("start channels get")
          cb()
        })
    )
  }

  getChannels() {
    return Object.keys(this.channels)
  }

  getChannelUsage(channel) {
    return (this.channels[channel] && this.channels[channel].count)
  }
}
