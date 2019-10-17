exports.getPeople = function() {
  const last = SSB.db.last.get()

  const people = []
  
  for (let id in SSB.profiles) {
    const profile = SSB.profiles[id]

    if (profile.image && last[id])
      SSB.net.blobs.localGet(profile.image, (err, url) => {
        people.push({
          id: id,
          name: profile.name || id,
          image: err ? '' : url
        })
      })
    else if (last[id])
      people.push({
        id: id,
        name: profile.name || id,
        image: ''
      })
  }

  return people
}
