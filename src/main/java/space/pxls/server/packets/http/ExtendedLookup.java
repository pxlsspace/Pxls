package space.pxls.server.packets.http;

import space.pxls.data.DBPixelPlacement;

public class ExtendedLookup extends Lookup {
    public final String login;
    public final String userAgent;

    public ExtendedLookup(int id, int x, int y, int pixel_count, int pixel_count_alltime, long time, String username, String discordName, String login, String userAgent) {
        super(id, x, y, pixel_count, pixel_count_alltime, time, username, discordName);
        this.login = login;
        this.userAgent = userAgent;

        // override for staff
        this.username = username;
        this.discordName = discordName;
        this.pixel_count = pixel_count;
        this.pixel_count_alltime = pixel_count_alltime;
    }

    public static ExtendedLookup fromDB(DBPixelPlacement pixelPlacement) {
        if (pixelPlacement == null) return null;
        return new ExtendedLookup(pixelPlacement.id, pixelPlacement.x, pixelPlacement.y, pixelPlacement.pixel_count, pixelPlacement.pixel_count_alltime, pixelPlacement.time, pixelPlacement.username, pixelPlacement.discordName, pixelPlacement.login, pixelPlacement.userAgent);
    }
}
