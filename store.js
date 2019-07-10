var Flume = require('flumedb')
if (process.title == 'node')
  var OffsetLog = require('flumelog-aligned-offset')
else // this will use IDBMutableFile in firefox, file system api in chrome
  var OffsetLog = require('flumelog-aligned-offset/browser')
var OffsetLogCompat = require('flumelog-aligned-offset/compat')
var ViewHashTable = require('flumeview-hashtable')
var codec = require('flumecodec/json')
var hash = require('ssb-keys/util').hash

var path = require('path')

function getId(msg) {
  return '%'+hash(JSON.stringify(msg, null, 2))
}

module.exports = function (dir) {
  console.log("dir:", dir)

  var log = OffsetLogCompat(OffsetLog(
    path.join(dir, 'log.offset'),
    {blockSize:1024*64, codec:codec}
  ))

  var store = Flume(log)
    .use('keys', ViewHashTable(2, function (key) {
      var b = new Buffer(key.substring(1,7), 'base64').readUInt32BE(0)
      return b
    }))

  store.add = function (msg, cb) {
    var data = {
      key: getId(msg),
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
