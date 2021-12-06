package space.pxls.server.packets.http;

import space.pxls.user.PlacementOverrides;
import space.pxls.user.Role;
import space.pxls.auth.Provider;
import space.pxls.server.packets.UserInfo;

import java.util.List;

public class ExtendedUserInfo extends UserInfo {
    public List<Provider> logins;

    public ExtendedUserInfo(
        String username,
        List<Role> roles,
        List<Provider> logins,
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
        String discordName,
        Number chatNameColor
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
            discordName,
            chatNameColor
        );

        this.logins = logins;
    }

    List<Provider> getLogins() {
        return logins;
    }
}
