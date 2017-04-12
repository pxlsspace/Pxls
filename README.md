# About
Pxls is a collaborative image editor where you can only place one pixel every 3 minutes.

# Requirements
Pxls requires Maven (for building), Java 8 (for running) and MariaDB (for databasing).

# Running
Pxls is a simple Java application, that can be run as follows:

    git clone https://github.com/xSke/Pxls
    cd Pxls
    mvn clean package
    java -jar target/pxls-1.0-SNAPSHOT.jar
  
The server will start on port 4567 by default, and will expose a rudimentary console with a few commands.

Pxls can be configured with a config file, `pxls.conf`, located in its working directory. The default values of all the options, as well as comments, can be seen in `resources/reference.conf` in the repo. The config file uses [HOCON](https://github.com/typesafehub/config/blob/master/HOCON.md).

Pxls will automatically save a backup of the map every five minutes to `$STORAGE/backups/board.<timestamp>.dat`,
as well as before executing a blank operation and right before exiting (via Ctrl-C).

# Configuring OAuth

OAuth keys must be set in the config file (see above). Right now, only two services are supported, reddit and Google.

You can obtain OAuth keys for Google [here](console.developers.google.com), for reddit [here][https://www.reddit.com/prefs/apps], and for Discord [here](https://discordapp.com/developers/applications/me).

The config node `oauth.callbackBase` must be set to your app's URL (including protocol and port), followed by `/auth` (for example, `http://pxls.space/auth`).
On the OAuth setup page for the various services, you need to set the redirect URL to `oauth.callbackBase`, followed by the service name. For reddit, for exampe, that would be `http://pxls.space/auth/reddit`, and likewise for Google.

An example OAuth section could look like this:

    oauth {
        callbackBase: "http://example.com/auth"
        reddit {
            key: qwertyuiop
            secret: qwertyuiopasdfghjkl
        }
        google {
            key: asdfghjkl
            secret: zxcvbnmqwertyuiop
        }
        discord {
            key: 123456789
            secret: abcdefghijklmn
        }
    }
    
# Configuring CAPTCHA

By default, CAPTCHAs are disabled, and need to be configured in the config file to work.
You will need a CAPTCHA key and secret, those can be created [here](https://www.google.com/recaptcha/admin). You must create an `Invisible reCAPTCHA` key.

The `captcha.host` key needs to be one of the approved domains on the ReCAPTCHA admin panel. For local testing, this will likely be `localhost` (no port).

An example CAPTCHA section could look like this:

    captcha {
        key: qwertyuiop
        secret: asdfghjkl
        host: example.com
    }


# Commands

Commands are entered directly into the running instance (stdin).

`role <user> <role>` - changes the role of a user, roles can be USER/MODERATOR/ADMIN
`reload` - reloads the main config file, applying *most* changes immediately  
`save` - saves the map  

# Contributors

* @xSke (main code)
* @jasperandrew (client UI/UX)