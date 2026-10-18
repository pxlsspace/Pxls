package space.pxls.server.packets.http;

import java.util.List;

import space.pxls.App;
import space.pxls.auth.Provider;
import space.pxls.auth.Provider.VisibleProvider;
import space.pxls.user.User;

public class ExtendedLookup extends Lookup {
    public final List<Provider> allLogins;
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
        String faction,
        List<VisibleProvider> logins,
        List<Provider> allLogins,
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
            logins, 
            faction
        );
        this.allLogins = allLogins;
        this.userAgent = userAgent;
    }

    public static ExtendedLookup fromDB(int x, int y) {
        return App.getDatabase().getFullPixelAt(x, y)
            .map(placement -> {
                User user = placement.getUser();
                return new ExtendedLookup(
                    placement.id,
                    placement.x,
                    placement.y,
                    originFromPixel(placement),
                    user.getPixelCount(),
                    user.getAllTimePixelCount(),
                    placement.time,
                    user.getName(),
                    user.getDisplayedFaction().map(f -> f.getName()).orElse(null),
                    user.getVisibleLogins(),
                    user.getAllLogins(),
                    user.getUserAgent()
                );
            })
            .orElse(null);
    }
}
