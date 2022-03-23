<div align="center">

![Pxls](https://i.imgur.com/K7j14LL.png)

![Java CI with Maven](https://img.shields.io/github/workflow/status/pxlsspace/Pxls/Java%20CI%20with%20Maven?style=flat-square)
[![GitHub issues](https://img.shields.io/github/issues/pxlsspace/Pxls?style=flat-square)](https://github.com/pxlsspace/Pxls/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/pxlsspace/Pxls?style=flat-square)](https://github.com/pxlsspace/Pxls/pulls)
[![GitHub contributors](https://img.shields.io/github/contributors/pxlsspace/Pxls?style=flat-square)](https://github.com/pxlsspace/Pxls/graphs/contributors)
[![GitHub stars](https://img.shields.io/github/stars/pxlsspace/Pxls?style=flat-square)](https://github.com/pxlsspace/Pxls/stargazers)

</div>

Pxls is a collaborative canvas where users can place one pixel from a limited palette at a time, inspired by Reddit's [r/Place][place] experiment.

**Note:** A Docker image is available at [aneurinprice/docker-pxls.space][docker] and on [Docker Hub][dockerhub].

# Installation

Automatically built `pxls*.jar` files are available as artifacts on each push [here][actions].

## Building

The following are required on the **build** system:

* [JDK 16][jdk16]
* [Apache Maven][maven]

The following are required on the **target** system:

* [JRE 16][jdk16]
* [Postgres][postgres]

To build, run `mvn clean package` in the project root.

The built `pxls*.jar` file is available in `target/`.

## Running

Copy the built `pxls*.jar` along with the following (renamed) to the instance directory:

* `reference.conf` (`pxls.conf`)
* `roles-reference.conf` (`roles.conf`)
* `palette-reference.conf` (`palette.conf`)

Edit configuration files as necessary. The following `pxls.conf` keys MUST be configured from default for an instance to run:

* `database.user`
* `database.pass`
* `database.url`
* `host`
* `oauth` (necessary for any form of user authentication)
    * [Reddit][redditapps], [Google][googleconsole], [Discord][discordapps], [VK][vkapps], and [Tumblr][tumblrapps] are current supported.

Run with `java -jar pxls*.jar`

# Notes

* The server will start on port `4567` by default.
* The instance has a [rudimentary console](#console-commands).
* The configuration file uses [HOCON][hocon].
* Unspecified configuration values will use built-in defaults from `resources/reference.conf`.
* Automatic backups of `board.dat` are saved every five minutes to `backups/` in the configured storage directory, as well as before exiting (with `CTRL + C`).
* The `Symbols` template style uses the reference palette configuration. See [here](developer.md#symbols-template-style) to modify or remove.

## Configuring CAPTCHA

CAPTCHAs are disabled by default and must be configured to work.
A [CAPTCHA key and secret][captcha] is needed and the type must be "Invisible reCAPTCHA".

The `host` configuration key must be an approved domain on the reCAPTCHA admin panel. For local testing, this will likely be `localhost` (no port).

An example CAPTCHA section could look like this:

```hocon
host: "example.com"

captcha {
  enabled: false
  // Captcha will show rougly 1/<threshold> times
  threshold: 5
  key: "6LcedG4UAAAAAKA6l9BbRPvZ2vt3lTrCQwz8rfPe"
  secret: "6LcedG4UAAAAAIXZcNFhnLKvTQwG1E8BzQQt_-MR"
  maxPixels: 0
  allTime: true
}
```

# Console Commands

Commands can be entered into the running instance through standard input.

`exact |exact| (required description) [optional description] one-or-more... DEFAULT/possible/values {description}`

## General

| Command | Arguments | Description |
| --- | --- | --- |
| `reload` || Reloads `pxls.conf` and `roles.conf`, applying _most_ changes immediately. Also reloads the user and faction cache. |
| `save` || Saves the board. |
| `alert` | `[message]` | Alerts every user with the given message (or blank if left empty). |
| `cons` | `[\|authed\|]` | Lists the total (or authenticated) connection count. |
| `users` || Lists all authenticated usernames. |
| `broadcast` | `(message)` | Sends the message in chat. |
| `cf` | `(query)` | Runs the query through the chat filter. |
| `relaodusers` || Reloads the user manager. **Laggy!** |
| `idlecheck` || Runs the user timeout check. |
| `senduserdata` || Broadcasts the non-idle user count in chat. |
| `addnotification` | `(title) (expiry) (body)` | Adds a new notification to the notification panel with the body. `+123` for the expiry means 123 seconds from now. |
| `bp` | `(packet)` | Broadcasts a raw JSON packet to all connections. |
| `up` | `(username) (packet)` | Broadcasts a raw JSON packet to all active connections from the user. |
| `f` | `(faction ID) [delete/tag [new tag]/name [new name]]` | Prints information about the faction or changes the tag or name. |

## Canvas Management

| Command | Arguments | Description |
| --- | --- | --- |
| `nuke` | `(x1) (y1) (x2) (y2) (color)` | Replaces all pixels from (`x1`, `y1`) to (`x2`, `y2`) with the specified color index. |
| `replace` | `(x1) (y1) (x2) (y2) (from color) (to color)` | Replaces all pixels from (`x1`, `y1`) to (`x2`, `y2`) matching the `from color` index with the `to color` index. |

## User Management

| Command | Arguments | Description |
| --- | --- | --- |
| `logins` | `(username) [{service ID}:{service user ID} ...]` | Gets or sets the user's login method(s). |
| `addlogins` | `(username) ({service ID}:{service user ID} ...`) | Adds login method(s) to the user. |
| `removelogins` | `(username) ({service ID}:{service user ID} ...`) | Removes login method(s) from the user. |
| `roles` | `(username) [role ID ...]` | Gets or sets the user's roles. |
| `addroles` | `(username) (role ID ...)` | Adds role(s) to the user. |
| `removeroles` | `(username) (role ID ...)` | Removes role(s) from the user. |
| `ban` | `(username) [reason]` | Bans the user for 24 hours with the given reason. |
| `permaban` | `(username) [reason]` | Permanently bans the user with the given reason. |
| `shadowban` | `(username) [reason]` | Shadowbans the user (making new pixels local) with the given reason. |
| `unban` | `(username) [{revert} TRUE/false] [reason]` | Unbans the user, reverting their pixels and with the given reason. |
| `stack` | `(user) [\|set\| (amount)]` | Gets or sets the user's stacked pixels. User must not be on cooldown before setting. |
| `placementOverride` | `\|list\|/(user) [placeAnyColor/ignoreCooldown/ignorePlacemap] [on/off]` | Lists all placement overrides or turns a placement override on/off for the user. |
| `captchaOverride` | `\|list\|/(user) [on/off]` | Lists all captcha overrides or turns it on/off for the user. |
| `chatban` | `(username) (length) ({purge} true/false) (reason)` | Bans the user from chat for the `length` in seconds, optionally purging all of their messages, with the given reason. |
| `permachatban` | `(username) ({purge} true/false) (reason)` | Permanently bans the user from chat optionally purging all of their messages, with the given reason. |
| `unchatban` | `(username)` | Unbans the user from chat. |
| `chatpurge` | `(username) [amount] [reason]` | Purges up to `amount` chat messages from the user for the given reason. |
| `flagrename` | `(username) [{flag} TRUE/false]` | Flags or unflags the user for rename. |
| `setname\|updateusername` | `(username) (new username)` | Renames the user. |

# Licenses
- This project includes icons from Font Awesome Free 5.9.0 by fontawesome - https://fontawesome.com
    - License: https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)


[place]: https://reddit.com/r/place/
[docker]: https://github.com/aneurinprice/docker-pxls.space
[dockerhub]: https://hub.docker.com/r/m08y/docker-pxls.space
[actions]: https://github.com/pxlsspace/Pxls/actions/workflows/maven.yml
[maven]: https://maven.apache.org/
[java]: https://www.java.com/en/download/linux_manual.jsp
[jdk16]: https://openjdk.java.net/projects/jdk/16/
[postgres]: https://www.postgresql.org/
[hocon]: https://github.com/typesafehub/config/blob/master/HOCON.md
[googleconsole]: https://console.developers.google.com
[redditapps]: https://www.reddit.com/prefs/apps
[discordapps]: https://discord.com/developers/applications/me
[vkapps]: https://vk.com/apps?act=manage
[tumblrapps]: https://www.tumblr.com/oauth/apps
[captcha]: https://www.google.com/recaptcha/admin
