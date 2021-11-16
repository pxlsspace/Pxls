package space.pxls.server.packets.http;

import java.util.List;

import space.pxls.App;

public class ExtendedLookup extends Lookup {
    public final List<String> logins;
    public final String userAgent;

    public ExtendedLookup(
        int id,
        int x,
        int y,
        String origin,
        int pixelCount,
        int pixelCountAllTime,
        long time,
        String username,
        String discordName,
        String faction,
        List<String> logins,
        String userAgent
    ) {
        super(
            id, 
            x, 
            y, 
            origin, 
            pixelCount, 
            pixelCountAllTime, 
            time, 
            username, 
            discordName, 
            faction
        );
        this.logins = logins;
        this.userAgent = userAgent;
    }

    public static ExtendedLookup fromDB(int x, int y) {
        return App.getDatabase().getFullPixelAt(x, y)
            .map(placement -> new ExtendedLookup(
                placement.id,
                placement.x,
                placement.y,
                originFromPixel(placement),
                placement.pixelCount,
                placement.pixelCountAlltime,
                placement.time,
                placement.username,
                placement.discordName,
                placement.faction,
                placement.logins,
                placement.userAgent
            ))
            .orElse(null);
    }
}
