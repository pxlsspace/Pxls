package space.pxls.server.packets;

import space.pxls.user.PlacementOverrides;
import space.pxls.user.Role;

import java.util.List;

public class UserInfo {
    public String username;
    public List<Role> roles;
    public int pixelCount;
    public int pixelCountAllTime;
    public Boolean banned;
    public Long banExpiry;
    public String banReason;
    public String method;
    public PlacementOverrides placementOverrides;
    public Boolean renameRequested;
    public String discordName;
    public Boolean twitchSubbed;

    public UserInfo(String username, List<Role> roles, int pixelCount, int pixelCountAllTime,
                    Boolean banned, Long banExpiry, String banReason, String method,
                    PlacementOverrides placementOverrides, Boolean renameRequested, String discordName, Boolean twitchSubbed) {
        this.username = username;
        this.roles = roles;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banned = banned;
        this.banExpiry = banExpiry;
        this.banReason = banReason;
        this.method = method;
        this.placementOverrides = placementOverrides;
        this.renameRequested = renameRequested;
        this.discordName = discordName;
        this.twitchSubbed = twitchSubbed;
    }

    public String getUsername() {
        return username;
    }

    public List<Role> getRoles() {
        return roles;
    }

    public Boolean getBanned() {
        return banned;
    }

    public Long getBanExpiry() {
        return banExpiry;
    }

    public String getBanReason() {
        return banReason;
    }

    public String getMethod() {
        return method;
    }

    public PlacementOverrides getPlacementOverrides() {
        return placementOverrides;
    }

    public Boolean getRenameRequested() {
        return renameRequested;
    }

    public String getDiscordName() {
        return discordName;
    }

    public Boolean isTwitchSubbed() {
        return twitchSubbed;
    }
}
