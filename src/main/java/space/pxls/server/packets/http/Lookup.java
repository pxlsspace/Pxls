package space.pxls.server.packets.http;

import space.pxls.App;
import space.pxls.data.DBPixelPlacement;

public class Lookup {
    public static final String ORIGIN_NUKE = "nuke";
    public static final String ORIGIN_MODACTION = "mod";

    public int id;
    public int x;
    public int y;
    public String origin;
    public Integer pixelCount;
    public Integer pixelCountAlltime;
    public long time;
    public String username;
    public String discordName = null;
    public String faction;

    public Lookup(int id, int x, int y, String origin, int pixelCount, int pixelCountAlltime, long time, String username, String discordName, String faction) {
        boolean isSnip = App.getSnipMode();
        this.id = id;
        this.x = x;
        this.y = y;
        this.origin = origin;
        this.pixelCount = username != null && !isSnip ? pixelCount : null;
        this.pixelCountAlltime = username != null && !isSnip ? pixelCountAlltime : null;
        this.time = time;
        this.username = isSnip ? "-snip-" : username;
        this.discordName = isSnip ? null : discordName;
        this.faction = isSnip ? null : faction;
    }

    public static String originFromPixel(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement.username == null) {
            return ORIGIN_NUKE;
        } else if(pixelPlacement.modAction) {
            return ORIGIN_MODACTION;
        }

        return null;
    }

    public static Lookup fromDB(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement == null) return null;
        return new Lookup(pixelPlacement.id, pixelPlacement.x, pixelPlacement.y, originFromPixel(pixelPlacement), pixelPlacement.pixelCount, pixelPlacement.pixelCountAlltime, pixelPlacement.time, pixelPlacement.username, pixelPlacement.discordName, pixelPlacement.faction);
    }
}
