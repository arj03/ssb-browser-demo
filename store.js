var Flume = require('flumedb')
if (process.title == 'node')
  var OffsetLog = require('flumelog-aligned-offset')
else // this will use IDBMutableFile in firefox, file system api in chrome
  var OffsetLog = require('flumelog-aligned-offset/browser')
var OffsetLogCompat = require('flumelog-aligned-offset/compat')
var codec = require('flumecodec/json')

var path = require('path')

module.exports = function (dir, ssbId) {
  console.log("dir:", dir)

  var log = OffsetLogCompat(OffsetLog(
    path.join(dir, 'log.offset'),
    {blockSize:1024*64, codec:codec}
  ))

  var store = Flume(log)
    .use('keys', require('./indexes/keys')())

  // ssb-db convention used by plugins
  store._flumeUse = function (name, flumeview) {
    store.use(name, flumeview)
    return store[name]
  }
  store.id = ssbId

  var backlinks = require('ssb-backlinks')
  store.backlinks = backlinks.init(store)

  store.add = function (id, msg, cb) {
    var data = {
      key: id,
      value: msg,
      timestamp: Date.now()
    }
    store.append(data, function (err) {
      if(err) cb(err)
      else cb(null, data)
    })
  }

  return store
}
