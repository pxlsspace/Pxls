package space.pxls.server.packets.http;

import java.util.List;

import space.pxls.App;
import space.pxls.auth.Provider.VisibleProvider;
import space.pxls.data.DBPixelPlacement;
import space.pxls.user.User;

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
    public List<VisibleProvider> logins;
    public String faction;

    public Lookup(
        int id,
        int x,
        int y,
        String origin,
        Integer pixelCount,
        Integer pixelCountAlltime,
        long time,
        String username,
        List<VisibleProvider> logins,
        String faction
    ) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.origin = origin;
        this.pixelCount = username != null ? pixelCount : null;
        this.pixelCountAlltime = username != null ? pixelCountAlltime : null;
        this.time = time;
        this.username = username;
        this.logins = logins;
        this.faction = faction;
    }

    public Lookup asSnipRedacted() {
        return new Lookup(id, x, y, origin, null, null, time, "-snip-", null, null);
    }

    public static String originFromPixel(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement.getUser() == null) {
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
        User user = pixelPlacement.getUser();
        return new Lookup(
            pixelPlacement.id,
            pixelPlacement.x,
            pixelPlacement.y,
            originFromPixel(pixelPlacement),
            user.getPixelCount(),
            user.getAllTimePixelCount(),
            pixelPlacement.time,
            user.getName(),
            user.getVisibleLogins(),
            user.getDisplayedFaction().map(f -> f.getName()).orElse(null)
        );
    }
}
