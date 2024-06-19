package space.pxls.server.packets.http;

import space.pxls.user.PlacementOverrides;
import space.pxls.user.Role;
import space.pxls.user.UserLogin;
import space.pxls.server.packets.UserInfo;

import java.util.List;

public class ExtendedUserInfo extends UserInfo {
    public List<UserLogin> logins;

    public ExtendedUserInfo(String username, List<Role> roles, List<UserLogin> logins, int pixelCount,
                            int pixelCountAllTime, Boolean banned, Long banExpiry, String banReason,
                            String method, PlacementOverrides placementOverrides, Boolean renameRequested,
                            String discordName) {
        super(username, roles, pixelCount, pixelCountAllTime, banned, banExpiry, banReason, method, placementOverrides, renameRequested, discordName);

        this.logins = logins;
    }

    List<UserLogin> getLogins() {
        return logins;
    }
}
