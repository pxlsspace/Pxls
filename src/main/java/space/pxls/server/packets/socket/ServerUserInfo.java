package space.pxls.server.packets.socket;

import space.pxls.user.Role;

import java.util.List;

public class ServerUserInfo {
    public String type = "userinfo";
    public String username;
    public String login;
    public List<Role> roles;
    public int pixelCount;
    public int pixelCountAllTime;
    public Boolean banned;
    public Long banExpiry;
    public String banReason;
    public String method;
    public Boolean cdOverride;
    public Boolean chatBanned;
    public String chatbanReason;
    public Boolean chatbanIsPerma;
    public Long chatbanExpiry;
    public Boolean renameRequested;
    public String discordName;
    public Number chatNameColor;

    public ServerUserInfo(String username, String login, List<Role> roles, int pixelCount, int pixelCountAllTime,
                          Boolean banned, Long banExpiry, String banReason, String method, Boolean cdOverride,
                          Boolean chatBanned, String chatbanReason, Boolean chatbanIsPerma, Long chatbanExpiry,
                          Boolean renameRequested, String discordName, Number chatNameColor) {
        this.username = username;
        this.login = login;
        this.roles = roles;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banned = banned;
        this.banExpiry = banExpiry;
        this.banReason = banReason;
        this.method = method;
        this.cdOverride = cdOverride;
        this.chatBanned = chatBanned;
        this.chatbanReason = chatbanReason;
        this.chatbanIsPerma = chatbanIsPerma;
        this.chatbanExpiry = chatbanExpiry;
        this.renameRequested = renameRequested;
        this.discordName = discordName;
        this.chatNameColor = chatNameColor;
    }

    public String getType() {
        return type;
    }

    public String getUsername() {
        return username;
    }

    public String getLogin() {
        return login;
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

    public Boolean getCdOverride() {
        return cdOverride;
    }

    public Boolean getChatBanned() {
        return chatBanned;
    }

    public String getChatbanReason() {
        return chatbanReason;
    }

    public Boolean getChatbanIsPerma() {
        return chatbanIsPerma;
    }

    public Long getChatbanExpiry() {
        return chatbanExpiry;
    }

    public Boolean getRenameRequested() {
        return renameRequested;
    }

    public String getDiscordName() {
        return discordName;
    }

    public Number getChatNameColor() {
        return chatNameColor;
    }
}
