SSB.getProfileName = function(profileId) {
  const profile = SSB.db.getIndex("profiles").getProfile(profileId)
  if (profile) return profile.name
  else return ''
}

SSB.getProfile = function(profileId) {
  return SSB.db.getIndex("profiles").getProfile(profileId)
}

SSB.searchProfiles = function(search, results = 10) {
  const profilesDict = SSB.db.getIndex("profiles").getProfiles()
  const profiles = []
  for (let p in profilesDict) {
    const pValue = profilesDict[p]
    profiles.push({ id: p, name: pValue.name, imageURL: pValue.imageURL })
  }
  return profiles.filter(x => x.name && x.name.toLowerCase().startsWith(search)).slice(0, results)
}
