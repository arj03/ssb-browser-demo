module.exports = function (componentsState) {
  const pull = require('pull-stream')
  const localPrefs = require('../localprefs')
  const userGroups = require('../usergroups')
  const { and, not, isPublic, type, channel, startFrom, paginate, descending, toCallback } = SSB.dbOperators

  return {
    template: `
    <div id="groups">
      <h2>{{ $t('groups.yourGroups') }}</h2>
      <div>
        <div v-for="group in groups">
          <h4><router-link :to="{name: 'group', params: { group: group.id }}">{{ group.name }}</router-link> <a href="javascript:void(0)" v-on:click="deleteGroup(group)" :title="$t('groups.deleteGroup')" style="color: #900;">X</a></h4>
          <ul class="groupMembers">
            <li v-for="member in group.members">
              <ssb-profile-link v-bind:key="member" v-bind:feedId="member"></ssb-profile-link>
            </li>
          </ul>
          <div class="clearingDiv"></div>
        </div>
        <input type="text" v-model="groupName" :placeholder="$t('groups.newGroupName')" />&nbsp;<button class="clickButton" v-on:click="addGroup">{{ $t('groups.addGroup') }}</button>
      </div>
    </div>`,

    data: function() {
      return {
        groups: [],
        groupName: ''
      }
    },

    methods: {
      groupMemberInfoCallback: function(err, groupId, members) {
        for (g in this.groups) {
          if (this.groups[g].id == groupId) {
            this.groups[g].members = members
            return
          }
        }
      },

      loadGroups: function() {
        var self = this
        userGroups.getGroups((err, groups) => {
          for (g in groups) {
            var found = false
            var fetchMembers = true
            for (l in self.groups) {
              if (groups[g].id == self.groups[l].id) {
                found = true
                if (self.groups[l].members && self.groups[l].members.length > 0) {
                  // Already have member info.
                  groups[g].members = self.groups[l].members
                  fetchMembers = false
                }
              }
            }

            if (!found) {
              groups[g].members = []
              self.groups.push(groups[g])
            }
            if (fetchMembers) {
              userGroups.getMembers(groups[g].id, self.groupMemberInfoCallback)
            }
          }

          // Normally I'd like to do this with a temporary variable and storing to the data variable once at the end, but in this case we've got too many potential member callbacks - complexity would be too high.
          const sortFunc = (new Intl.Collator()).compare
          self.groups = self.groups.sort((a, b) => { return sortFunc(a.name, b.name) })
        })
      },

      addGroup: function() {
        var self = this
        userGroups.addGroup({ name: this.groupName }, (err, groupId) => {
          if (err) {
            alert(err)
          } else {
            self.loadGroups()
            self.groupName = ''
          }
        })
      },

      deleteGroup: function(group) {
        var self = this
        if (confirm(this.$root.$t('channels.confirmDeleteGroup', { group: group.name }))) {
          userGroups.deleteGroup(group.id, (err, success) => {
            if (err)
              alert(err)
            else {
              self.groups = []
              self.loadGroups()
            }
          })
        }
      },

      load: function() {
        this.loadGroups()
      },
    },

    created: function () {
      document.title = this.$root.appTitle + " - " + this.$root.$t('groups.title')

      this.load()
    }
  }
}
