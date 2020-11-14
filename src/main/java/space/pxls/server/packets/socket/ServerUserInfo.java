package space.pxls.server.packets.socket;

import java.util.List;

import space.pxls.server.packets.UserInfo;
import space.pxls.user.Role;

public class ServerUserInfo extends UserInfo {
	public final String type = "userinfo";

	public ServerUserInfo(String username, List<Role> roles, int pixelCount, int pixelCountAllTime, Boolean banned,
                        Long banExpiry, String banReason, String method, Boolean cdOverride, Boolean chatBanned, String chatbanReason,
                        Boolean chatbanIsPerma, Long chatbanExpiry, Boolean renameRequested, String discordName, Number chatNameColor) {
        super(username, roles, pixelCount, pixelCountAllTime, banned, banExpiry, banReason, method, cdOverride, chatBanned, chatbanReason, chatbanIsPerma, chatbanExpiry, renameRequested, discordName, chatNameColor);
	}

	public String getType() {
        return type;
	}
}
