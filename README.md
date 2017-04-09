# About
Pxls is a collaborative image editor where you can only place one pixel every 3 minutes.

# Running
Pxls is a simple Java application, that can be run as follows:

    git clone https://github.com/xSke/Pxls
    cd Pxls
    mvn clean package
    java -jar target/pxls-1.0-SNAPSHOT.jar
  
The server will start on port 4567 by default, and will expose a rudimentary console with a few commands.

Pxls can be configured with a few environment variables:

`CANVAS_WIDTH` - the width of the canvas (default 1000)  
`CANVAS_HEIGHT` - the height of the canvas (default 1000)  
`COOLDOWN` - the cooldown to apply between pixel placements, in seconds (default 180)  
`PORT` - the port to run the web server on (default 4567)  
`STORAGE` - the directory to store map data, logs, and backups (default .)  
`CAPTCHA_KEY` - the Invisible ReCaptcha secret key (default none, captcha disabled)  
`CAPTCHA_THRESHOLD` - how often the captcha should appear (higher threshold = less captchas)
`BAN_TOR` - whether to ban tor exit nodes, true/false (default true)

Pxls will automatically save a backup of the map every five minutes to `$STORAGE/backups/board.<timestamp>.dat`,
as well as before executing a blank operation and right before exiting (via Ctrl-C).

# Commands

Commands are entered directly into the running instance (stdin).

`cooldown <secs>` - changes the cooldown server-wide  
`alert <message>` - broadcasts an alert message to all clients  
`blank <x1> <y1> <x2> <y2>` - wipes out a section of the map to white, logging as `<blank operation>` and backing up beforehand  
`trusted` - lists all trusted IPs (a trusted IP has no captcha or cooldown, does not persist through restarts)  
`trust <ip>` - adds an IP to the trusted list  
`untrust <ip>` - removes an IP from the trusted list  
`ban <ip>` - bans an IP (does not persist through restarts) 
`unban <ip>` - unbans an IP  
`captcha_threshold <threshold>` - changes the captcha threshold, see above  
`save` - saves the map  