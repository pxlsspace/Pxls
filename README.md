# About
Pxls is a collaborative image editor where you can only place one pixel every 3 minutes.

# Running
Pxls is a simple Java application, that can be run as follows:

    git clone https://github.com/xSke/Pxls
    cd Pxls
    mvn clean package
    java -jar target/pxls-1.0-SNAPSHOT.jar
  
The server will start on port 4567 by default, and will expose a rudimentary console with a few commands.

Pxls can be configured with a config file, `pxls.conf`, located in its working directory. The default values of all the options can be seen in `resources/reference.conf` in the repo. The config file uses [HOCON](https://github.com/typesafehub/config/blob/master/HOCON.md).


Pxls will automatically save a backup of the map every five minutes to `$STORAGE/backups/board.<timestamp>.dat`,
as well as before executing a blank operation and right before exiting (via Ctrl-C).

# Commands

Commands are entered directly into the running instance (stdin).

`alert <message>` - broadcasts an alert message to all clients  
`blank <x1> <y1> <x2> <y2> <to> <from>` - wipes out a section of the map to `<to>` (or white), only touching `<from>` (or all colors), logging as `<blank operation>` and backing up beforehand  
`reload` - reloads the main config file, applying *most* changes immediately  
`save` - saves the map  

# Contributors

* @xSke (main code)
* @jasperandrew (UI/UX tweaks)