package space.pxls.server.packets.http;

import space.pxls.App;
import space.pxls.data.DBPixelPlacementUser;

public class Lookup {
    public int id;
    public int x;
    public int y;
    public int pixel_count;
    public int pixel_count_alltime;
    public long time;
    public String username;
    public String discordName = null;

    public Lookup(int id, int x, int y, int pixel_count, int pixel_count_alltime, long time, String username, String discordName) {
        boolean isSnip = App.getConfig().getBoolean("oauth.snipMode");
        this.id = id;
        this.x = x;
        this.y = y;
        this.pixel_count = isSnip ? 0 : pixel_count;
        this.pixel_count_alltime = isSnip ? 0 : pixel_count_alltime;
        this.time = time;
        this.username = isSnip ? "-snip-" : username;
        this.discordName = isSnip ? (discordName != null ? "-snip-" : null) : discordName; // if we're in snip mode, we want to filter the name, otherwise we'll just accept whatever was thrown at us. original serialization utilized nulls.
    }

    public static Lookup fromDB(DBPixelPlacementUser pixelPlacementUser) {
        if (pixelPlacementUser == null) return null;
        return new Lookup(pixelPlacementUser.id, pixelPlacementUser.x, pixelPlacementUser.y, pixelPlacementUser.pixel_count, pixelPlacementUser.pixel_count_alltime, pixelPlacementUser.time, pixelPlacementUser.username, pixelPlacementUser.discordName);
    }
}
