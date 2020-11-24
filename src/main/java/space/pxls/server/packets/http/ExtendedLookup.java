package space.pxls.server.packets.http;

import space.pxls.data.DBPixelPlacementFull;

public class ExtendedLookup extends Lookup {
    public final String login;
    public final String userAgent;

    public ExtendedLookup(int id, int x, int y, String origin, int pixelCount, int pixelCountAllTime, long time, String username, String discordName, String faction, String login, String userAgent) {
        super(id, x, y, origin, pixelCount, pixelCountAllTime, time, username, discordName, faction);
        this.login = login;
        this.userAgent = userAgent;

        // override for staff
        this.username = username;
        this.discordName = discordName;
        this.pixelCount = username != null ? pixelCount : null;
        this.pixelCountAlltime = username != null ? pixelCountAlltime : null;
    }

    public static ExtendedLookup fromDB(DBPixelPlacementFull pixelPlacement) {
        if (pixelPlacement == null) return null;
        return new ExtendedLookup(pixelPlacement.id, pixelPlacement.x, pixelPlacement.y, originFromPixel(pixelPlacement), pixelPlacement.pixelCount, pixelPlacement.pixelCountAlltime, pixelPlacement.time, pixelPlacement.username, pixelPlacement.discordName, pixelPlacement.faction, pixelPlacement.login, pixelPlacement.userAgent);
    }
}
