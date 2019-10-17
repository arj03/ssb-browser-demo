var pull = require('pull-stream')

var feedId = '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519'

// ripped out of ssb-social-index because we need the keys, not the values
function read (sbot, dest) {
  const content = { type: 'about' }
  content['about'] = dest

  return pull(
    sbot.backlinks.read({
      reverse: true,
      query: [{ $filter: {
        dest,
        value: { content: content }
      } }]
    })
  )
}

function latestValueSelf(sbot, key, dest, cb) {
  var value = null
  var msgKey = null
  pull(
    read(sbot, dest),
    pull.filter(msg => {
      return msg.value.content && msg.value.content[key] &&
        !(msg.value.content[key] && msg.value.content[key].remove) &&
        msg.value.author == dest
    }),
    pull.take(1),
    pull.drain(msg => {
      value = msg.value.content[key]
      msgKey = msg.key
    }, (err) => {
      if (err) return cb(err)
      cb(null, { msgKey, value } )
    })
  )
}

function latestValueFriends(sbot, key, dest, friends, cb) {
  var value = null
  var msgKey = null
  pull(
    read(sbot, dest),
    pull.filter(msg => {
      return msg.value.content && msg.value.content[key] &&
        !(msg.value.content[key] && msg.value.content[key].remove) &&
        friends.includes(msg.value.author)
    }),
    pull.take(1),
    pull.drain(msg => {
      value = msg.value.content[key]
      msgKey = msg.key
    }, (err) => {
      if (err) return cb(err)
      cb(null, { msgKey, value } )
    })
  )
}

require('ssb-client')(function (err, sbot) {
  if(err) throw err

  // key => { lastest name about, latest image about, last message }
  var data = {}
  var asyncs = 0

  function check_async() {
    asyncs -= 1
    if (asyncs == 0) {
      var total = 0
      var max = 0
      var count = 0
      var oldest = new Date()
      oldest.setMonth(oldest.getMonth() - 3)
      oldest = +oldest
      for (var f in data) {
	if (data[f].latestMsg && data[f].latestMsg.timestamp > oldest) {
	  total += data[f].latestMsg.seq
          if (data[f].latestMsg.seq > max)
            max = data[f].latestMsg.seq
          count++
        }
      }
      /*
      console.log(total)
      console.log(count)
      console.log(max)
      */
      console.log(JSON.stringify(data))
      
      sbot.close()
    }
  }
  
  pull(
    sbot.friends.hopStream({live: false, old: true}),
    pull.drain((hops) => {
      var friends = Object.keys(hops).filter(feedId => hops[feedId] <= 1)
      friends.forEach((friend) => {
        asyncs += 1
        sbot.friends.isFollowing({
          source: feedId,
          dest: friend
        }, (err, isOk) => {
          if (isOk) {
            data[friend] = {}

            asyncs += 1

            latestValueSelf(sbot, 'name', friend, (err, res) => {
              data[friend].nameAbout = res.msgKey
              data[friend].name = res.value
              check_async()
            })

            asyncs += 1
            
            latestValueSelf(sbot, 'image', friend, (err, res) => {
              if (res.msgKey == null) {
                asyncs += 1

                latestValueFriends(sbot, 'image', friend, friends, (err, res) => {
                  if (res.msgKey != null) {
                    data[friend].imageAbout = res.msgKey
	            if (typeof(res.value) == 'string')
		      data[friend].image = res.value
	            else if (res.value && res.value.link)
		      data[friend].image = res.value.link
                  }

                  check_async()
                })
              }
              else
              {
                data[friend].imageAbout = res.msgKey
	        if (typeof(res.value) == 'string')
		  data[friend].image = res.value
	        else if (res.value && res.value.link)
		  data[friend].image = res.value.link
              }
              check_async()
            })

            asyncs += 1
            
            latestValueSelf(sbot, 'description', friend, (err, res) => {
              data[friend].descriptionAbout = res.msgKey
              data[friend].description = res.value
              check_async()
            })

            asyncs += 1

            pull(
              sbot.createUserStream({
                id: friend,
                reverse: true,
                limit: 1
              }),
              pull.drain((msg) => {
                data[friend].latestMsg = {
                  //key: msg.key,
                  seq: msg.value.sequence,
                  timestamp: msg.value.timestamp
                }

              }, check_async)
            )

            check_async()

          } else {
            check_async()
          }
        })
      })
    })
  )
})
