const localPrefs = require("./localprefs")

// Groups are stored as:
// {
//   id: (String, with the format not to be relied upon outside of this module)
//   name: 'Name of group',
//   description: 'Description of group in Markdown format (optional)',
//   members: [
//     '@id_of_a_user',
//     '@id_of_another_user'
//   ]
// }

function getFullLocalGroupInfo() {
  return localPrefs.getUserGroups()
}

function setFullLocalGroupInfo(groups) {
  localPrefs.setUserGroups(groups)
}

// Gets the names and IDs of groups, but not their members, in case that becomes a more time-consuming search later.
// This is a little roundabout for the way it's implemented right now, but I expect it will yield performance benefits if/when we persist this to SSB.
exports.getGroups = function(cb) {
  const groups = getFullLocalGroupInfo().map((x) => { return { name: x.name, id: x.id, description: x.description || '' } })

  cb(null, groups)
}

exports.addGroup = function(groupInfo, cb) {
  if (!groupInfo.name || groupInfo.name.trim() == '') {
    cb("Group must have a name")
  }

  // Good enough for now, until we find a way to persist this.
  // This is purely to make sure the API references things by ID instead of by name, so we can swap out the implementation later.
  var id = (new Date()).getTime()

  var groups = getFullLocalGroupInfo()
  var newGroup = { name: groupInfo.name, id: id, members: [] }
  if (groupInfo.description)
    newGroup.description = groupInfo.description
  groups.push(newGroup)
  setFullLocalGroupInfo(groups)

  cb(null, id)
}

exports.updateGroup = function(groupId, groupInfo, cb) {
  var groups = getFullLocalGroupInfo()
  var updated = false
  for (g in groups) {
    if (groups[g].id == groupId) {
      if (groupInfo.name && groupInfo.name.trim() != '') {
        groups[g].name = groupInfo.name
        updated = true
      }
      if (groupInfo.description) {
        groups[g].description = groupInfo.description
        updated = true
      }
    }
  }
  if (!updated)
    cb("Group not found")
  else {
    setFullLocalGroupInfo(groups)
    cb(null, true)
  }
}

exports.deleteGroup = function(groupId, cb) {
  var groups = getFullLocalGroupInfo()
  groups = groups.filter((x) => { return x.id != groupId })
  setFullLocalGroupInfo(groups)
  cb(null, true)
}

exports.getMembers = function(groupId, cb) {
  var groups = getFullLocalGroupInfo()
  for (g in groups)
    if (groups[g].id == groupId) {
      cb(null, groupId, groups[g].members)
      return
    }

  cb("Group not found")
}

exports.addMember = function(groupId, feedId, cb) {
  var groups = getFullLocalGroupInfo()
  for (g in groups)
    if (groups[g].id == groupId) {
      if (groups[g].members.indexOf(feedId) >= 0) {
        cb("Group already has member")
        return
      } else {
        groups[g].members.push(feedId)
        setFullLocalGroupInfo(groups)
        cb(null, true)
        return
      }
    }

  cb("Group not found")
}

exports.removeMember = function(groupId, feedId, cb) {
  var groups = getFullLocalGroupInfo()
  for (g in groups)
    if (groups[g].id == groupId) {
      if (groups[g].members.indexOf(feedId) < 0) {
        cb("Group does not have member")
        return
      } else {
        groups[g].members = groups[g].members.filter((x) => { return x != feedId })
        setFullLocalGroupInfo(groups)
        cb(null, true)
        return
      }
    }

  cb("Group not found")
}

