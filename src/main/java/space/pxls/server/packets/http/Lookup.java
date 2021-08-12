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

    public Lookup(int id, int x, int y, String origin, Integer pixelCount, Integer pixelCountAlltime, long time, String username, String discordName, String faction) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.origin = origin;
        this.pixelCount = username != null ? pixelCount : null;
        this.pixelCountAlltime = username != null ? pixelCountAlltime : null;
        this.time = time;
        this.username = username;
        this.discordName = discordName;
        this.faction = faction;
    }

    public Lookup asSnipRedacted() {
        return new Lookup(id, x, y, origin, null, null, time, "-snip-", null, null);
    }

    public static String originFromPixel(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement.username == null) {
            return ORIGIN_NUKE;
        } else if(pixelPlacement.modAction) {
            return ORIGIN_MODACTION;
        }

        return null;
    }

    public static Lookup fromDB(int x, int y) {
        return Lookup.fromDB(App.getDatabase().getPixelAt(x, y).orElse(null));
    }

    public static Lookup fromDB(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement == null) return null;
        return new Lookup(
            pixelPlacement.id,
            pixelPlacement.x,
            pixelPlacement.y,
            originFromPixel(pixelPlacement),
            pixelPlacement.pixelCount,
            pixelPlacement.pixelCountAlltime,
            pixelPlacement.time,
            pixelPlacement.username,
            pixelPlacement.discordName,
            pixelPlacement.faction
        );
    }
}
