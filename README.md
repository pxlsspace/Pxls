# Pxls

Pxls is a collaborative image editor where you can place up to six pixels at a time, inspired by Reddit's [r/Place][place] experiment.

## Prerequisites

- [Maven][maven]
- [Java 8][java]
- [JDK (for development)][jdk8]
- [MariaDB][mariadb]

## Building

1. Install the above requirements either via package manager (recommended) or by building from their sources.
2. Clone the repo:

    > $ git clone git@github.com:xSke/Pxls.git

3. Navigate to the directory:

    > $ cd Pxls

4. Clean the package:

    > $ mvn clean package

The output `.jar` is in `target/`.

## Running

1. Create a new directory.
2. Copy `resources/` and the output `.jar` to it.
3. Copy `resources/reference.conf` to the directory as `pxls.conf`.
4. Configure `pxls.conf`.
5. Execute the jar with `java -jar pxls-1.0-SNAPSHOT.jar`
  
The server will start on port 4567 by default, and will expose a rudimentary console with a few commands (listed in `Commands` below).
You will need to configure the database for the server to start, see the `Configuring Database` section below.

The config file uses [HOCON][hocon]. The config will not be automatically created, you must create/copy it yourself. Any unspecified option will use the default value from `resources/reference.conf`.

Pxls will automatically save a backup of the map every five minutes to `$STORAGE/backups/board.<timestamp>.dat`,
as well as before executing a blank operation and right before exiting (via Ctrl-C).

## Configuring Database

You will need to set the database URI/credentials in `pxls.conf`.

The relevant config options are `database.url`, `database.user`, and `database.pass`. An example database section in the config could look like this:

    database {
      driver: org.mariadb.jdbc.driver
      url: "jdbc:mariadb://localhost:3306/pxls"
      user: AzureDiamond
      pass: hunter2
    }

## Configuring OAuth

OAuth keys must be set in the config file (see above). Right now, five services are supported - [Reddit][redditapps], [Google][googleconsole], [Discord][discordapps], [VK][vkapps], and [Tumblr][tumblrapps].

The config node `oauth.callbackBase` must be set to your app's URL (including protocol and port), followed by `/auth` (for example, `http://pxls.space/auth`).
On the OAuth setup page for the various services, you need to set the redirect URL to `oauth.callbackBase` followed by the service name. Reddit, for example, would be `http://pxls.space/auth/reddit`, and likewise for Google.

An example OAuth section could look like this:

    oauth {
        callbackBase: "http://example.com/auth"
        reddit {
            key: AsPxXweEomQjUD
            secret: tYJlz_xbH-qjxw8xvKVj0qLXRCw
        }
        google {
            key: pxls-
            secret: AIzaSzAS9wxgdXw6G3Q2lGMlyxG03F3hmXEMnce
        }
        discord {
            key: 112233445566778899
            secret: yo4DkHFDy0k1euPyxMef6m243qRgX00z
        }
    }
    
## Configuring CAPTCHA

By default, CAPTCHAs are disabled, and need to be configured in the config to work.
You will need a [CAPTCHA key and secret][captcha]. The type must be `Invisible reCAPTCHA`.

The `captcha.host` key needs to be one of the approved domains on the reCAPTCHA admin panel. For local testing, this will likely be `localhost` (no port).

An example CAPTCHA section could look like this:

    captcha {
        key: 6LcedG4UAAAAAKA6l9BbRPvZ2vt3lTrCQwz8rfPe
        secret: 6LcedG4UAAAAAIXZcNFhnLKvTQwG1E8BzQQt_-MR
        host: example.com
    }


## Commands

Commands are entered directly into the running instance (stdin):

- `reload` - Reloads the main configuration, applying _most_ changes immediately.
- `save` - Saves the map.
- `role <user> <role>` - Changes the role of the user. The role can be either `USER`, `TRIALMOD`, `MODERATOR`, or `ADMIN`.
- `alert <text>` - Sends an popup-like alert to all users on the canvas.
- `ban <user> <reason>` - Bans the user for 24 hours, with the specified reason (if any).
- `permaban <user> <reason>` - Permanently bans the user, with the specified reason (if any).
- `shadowban <user> <reason>` - Shadowbans the user (hiding newly-placed pixels to all but themself), with the specified reason (if any).
- `unban <user>` - Unbans the user.
- `nuke <x1> <y1> <x2> <y2> <color>` - Replaces all pixels from (`x1`, `y1`) to (`x2`, `y2`) with the color (by index).
- `cons [authed]` - Lists the total (or authed) connection count.
- `users` - Lists all of the authed users, by username.
- `stack <user> [set <amount>]` - Sets the user's stack count. The user must not be on cooldown before setting.

## Contributors

* [xSke](https://github.com/xSke) - Main code
* [jasperandrew](https://github.com/jasperandrew) - Client UI/UX
* [Sorunome](https://github.com/Sorunome) - Loads of client improvements
* [TheRebelG0d](https://github.com/TheRebelG0d) - Loads of client improvements
* [haykam821](https://github.com/haykam821) - Copy link and color-switching keybinds
* [FlyingSixtySix](https://github.com/FlyingSixtySix) - Miscellaneous contributions

A full list of contributors is available [here](https://github.com/xSke/Pxls/graphs/contributors).


[place]: https://reddit.com/r/place/
[maven]: https://maven.apache.org/
[java]: https://www.java.com/en/download/linux_manual.jsp
[jdk8]: http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html
[mariadb]: https://mariadb.com/
[hocon]: https://github.com/typesafehub/config/blob/master/HOCON.md
[googleconsole]: https://console.developers.google.com
[redditapps]: https://www.reddit.com/prefs/apps
[discordapps]: https://discordapp.com/developers/applications/me
[vkapps]: https://vk.com/apps?act=manage
[tumblrapps]: https://www.tumblr.com/oauth/apps
[captcha]: https://www.google.com/recaptcha/admin