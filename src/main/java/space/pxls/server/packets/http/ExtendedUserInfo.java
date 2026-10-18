package space.pxls.server.packets.http;

import space.pxls.user.PlacementOverrides;
import space.pxls.user.Role;
import space.pxls.auth.Provider;
import space.pxls.auth.Provider.VisibleProvider;
import space.pxls.server.packets.UserInfo;

import java.util.List;

public class ExtendedUserInfo extends UserInfo {
    public List<Provider> allLogins;

    public ExtendedUserInfo(
        String username,
        List<Role> roles,
        List<VisibleProvider> logins,
        int pixelCount,
        int pixelCountAllTime,
        Boolean banned,
        Long banExpiry,
        String banReason,
        String method,
        PlacementOverrides placementOverrides,
        Boolean chatBanned,
        String chatbanReason,
        Boolean chatbanIsPerma,
        Long chatbanExpiry,
        Boolean renameRequested,
        Number chatNameColor,
        List<Provider> allLogins
    ) {
        super(
            username,
            roles,
            pixelCount,
            pixelCountAllTime,
            banned,
            banExpiry,
            banReason,
            method,
            placementOverrides,
            chatBanned,
            chatbanReason,
            chatbanIsPerma,
            chatbanExpiry,
            renameRequested,
            logins,
            chatNameColor
        );

        this.allLogins = allLogins;
    }

    List<Provider> getAllLogins() {
        return allLogins;
    }
}
