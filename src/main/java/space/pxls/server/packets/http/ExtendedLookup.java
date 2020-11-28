package space.pxls.server.packets.http;

import java.util.List;
import java.util.stream.Collectors;

import space.pxls.data.DBPixelPlacementFull;
import space.pxls.data.DBUserLogin;
import space.pxls.user.UserLogin;
import space.pxls.App;

public class ExtendedLookup extends Lookup {
    public final List<UserLogin> logins;
    public final String userAgent;

    public ExtendedLookup(int id, int x, int y, String origin, int pixelCount, int pixelCountAllTime, long time, String username, String discordName, String faction, List<UserLogin> logins, String userAgent) {
        super(id, x, y, origin, pixelCount, pixelCountAllTime, time, username, discordName, faction);
        this.logins = logins;
        this.userAgent = userAgent;

        // override for staff
        this.username = username;
        this.discordName = discordName;
        this.pixelCount = username != null ? pixelCount : null;
        this.pixelCountAlltime = username != null ? pixelCountAlltime : null;
    }

    public static Lookup fromDB(int x, int y) {
        var pixelPlacement = App.getDatabase().getFullPixelAt(x, y).orElse(null);
        if (pixelPlacement == null) return null;
        var logins = App.getDatabase().getUserLogins(pixelPlacement.userId);
        return ExtendedLookup.fromDB(pixelPlacement, logins);
    }

    public static ExtendedLookup fromDB(DBPixelPlacementFull pixelPlacement, List<DBUserLogin> logins) {
        if (pixelPlacement == null) return null;
        return new ExtendedLookup(
            pixelPlacement.id,
            pixelPlacement.x,
            pixelPlacement.y,
            originFromPixel(pixelPlacement),
            pixelPlacement.pixelCount,
            pixelPlacement.pixelCountAlltime,
            pixelPlacement.time,
            pixelPlacement.username,
            pixelPlacement.discordName,
            pixelPlacement.faction,
            logins.stream().map((login) -> UserLogin.fromDB(login)).collect(Collectors.toList()),
            pixelPlacement.userAgent
        );
    }
}
