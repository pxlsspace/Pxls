package space.pxls.server.packets.socket;

import space.pxls.user.Role;
import space.pxls.server.packets.UserInfo;
import space.pxls.user.PlacementOverrides;

import java.util.List;

public class ServerUserInfo extends UserInfo {
	public final String type = "userinfo";

	public ServerUserInfo(String username, List<Role> roles, int pixelCount, int pixelCountAllTime, Boolean banned,
                        Long banExpiry, String banReason, String method, PlacementOverrides placementOverrides,
                        Boolean chatBanned, String chatbanReason, Boolean chatbanIsPerma, Long chatbanExpiry,
                        Boolean renameRequested, String discordName, Number chatNameColor) {
        super(username, roles, pixelCount, pixelCountAllTime, banned, banExpiry, banReason, method, placementOverrides, chatBanned, chatbanReason, chatbanIsPerma, chatbanExpiry, renameRequested, discordName, chatNameColor);
	}

	public String getType() {
        return type;
	}
}
