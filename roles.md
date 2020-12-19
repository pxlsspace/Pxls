# Roles

Roles are multi-assignable user groups. Roles can inherit the permissions of other roles. The structure of a role looks like so:

```hocon
roleID {
  name: Role Name
  type: GUEST | USER | STAFF
  default: true | false
  inherits: [ roleID, ... ]
  badges: [
    {
      name: Badge Name
      tooltip: Badge Tooltip
      type: text | icon
      cssIcon: fas fa-icon-name
    }
  ]
  permissions: [
    permission.node
  ]
}
```

| Key | Optional | Type | Purpose |
| --- | --- | --- | --- |
| `roleID` | No | `String` | Case-sensitive role identifier |
| `name` | No | `String` | Role display name |
| `guest` | Yes | `Boolean` | Whether or not all visitors have the role |
| `default` | Yes | `Boolean` | Whether or not the role is assigned after registration |
| `inherits` | Yes | `String[]` | IDs of roles to inherit permissions of |
| `badges` | Yes | `Object[]` | Badges that appear next to the username in chat |
| `badge.name` | No | `String` | Name of the badge |
| `badge.tooltip` | No | `String` | Text that appears when hovering over the badge |
| `badge.type` | No | `String` | Display type of badge |
| `badge.cssIcon` | No | `String` | CSS class(es) of icon |
| `permissions` | Yes | `String[]` | Role permissions nodes |

## Permissions

### Board

| Node | Endpoint | Purpose | Default Role |
| --- | --- | --- | --- |
| `board.check` | `/admin/check` | Detailed user lookups **\[!\]** | staff |
| `board.data` | `/boarddata`, `/heatmap`, `/virginmap`, `/placemap` | Access all forms of board data | guest |
| `board.info` | `/info` | Access to basic board metadata | guest |
| `board.lookup` | `/lookup` | Pixel information lookups | user |
| `board.place` | | Place pixels | user |
| `board.report` | `/report` | Report pixels | user |
| `board.socket` | `/ws` | Access live board updates | guest |
| `board.undo` | | Undo pixels | user |
| `board.cooldown.ignore`, `board.cooldown.override` | | Ignore cooldown (when enabled) | moderator, developer |
| `board.palette.all` | | Select and place any valid color, including transparent pixels (when enabled) | moderator, developer |
| `board.placemap.ignore` | | Place on the placemap (when enabled) | administrator, developer |

\[!\] Includes sensitive information (e.g. login method, user-agent, ban data)

### Chat

| Node | Endpoint/Type | Purpose | Default Role |
| --- | --- | --- | --- |
| `chat.ban` | `/admin/chatban` | Chat-ban users | staff |
| `chat.delete` | `/admin/delete` | Delete chat messages | staff |
| `chat.history` | | Retrieve chat history | user |
| `chat.history.purged` | | Show purged messages in chat and chat history | staff |
| `chat.lookup` | | Chat message lookups | staff |
| `chat.purge` | `/admin/chatPurge` | Purge (multiple) chat messages | staff |
| `chat.report` | `/reportChat` | Report chat messages | user |
| `chat.send` | | Send chat messages | user |
| `chat.usercolor.rainbow` | | Ability to use rainbow user color | staff |
| `chat.usercolor.donator` | | Ability to use donator user color | donator |

### User

| Node | Endpoint | Purpose | Default Role |
| --- | --- | --- | --- |
| `user.admin` | `/admin/*` | Access to admin client resources | staff |
| `user.donator` | `/donator/*` | donator role | donator |
| `user.alert` | | Alerts users | staff |
| `user.auth` | `/auth`, `/signin`, `/signup`, `/logout` | User authentication | guest |
| `user.auth` | `/whoami` | List own username and ID | guest |
| `user.ban` | `/admin/ban` | Time-ban users | staff |
| `user.chatColorChange` | `/chat/setColor` | Change color in chat | user |
| `user.discordNameChange` | `/setDiscordName` | Change Discord tag | user |
| `user.namechange` | `/execNameChange` | Execute staff-initiated name changes | staff |
| `user.namechange.flag` | `/admin/flagNameChange` | Flag users to change their name | staff |
| `user.namechange.force` | `/admin/forceNameChange` | Force prompt for users to change their name | staff |
| `user.online` | `/users` | List online user count | guest |
| `user.permaban` | `/admin/permaban` | Permanently ban users | staff |
| `user.ratelimits.bypass` | | Bypass rate limits | staff |
| `user.shadowban` | `/admin/shadowban` | Shadow-ban users | staff |
| `user.unban` | `/admin/unban` | Unban users | staff |

### Faction

| Node | Endpoint | Purpose | Default Role |
| --- | --- | --- | --- |
| `faction.delete` | `/admin/faction/delete` | Delete other factions | staff |
| `faction.edit` | `/admin/faction/edit` | Edit other factions | staff |
| `faction.setblocked` | `/admin/setFactionBlocked` | Set block status on factions | staff |

### Notification

| Node | Endpoint | Purpose | Default Role |
| --- | --- | --- | --- |
| `notification.create` | `/createNotification` | Create notifications | staff |
| `notification.discord` | `/sendNotificationToDiscord` | Send notifications to Discord | staff |
| `notification.expired` | `/setNotificationExpired` | Mark notifications as expired | staff |
| `notification.list` | `/notifications` | List active notifications | guest |
