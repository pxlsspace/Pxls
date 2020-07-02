package space.pxls.server.packets.socket;

public class ServerUserInfo {
    public String type = "userinfo";
    public String username;
    public String login;
    public String role;
    public int pixelCount;
    public int pixelCountAllTime;
    public Boolean banned;
    public Long banExpiry;
    public String ban_reason;
    public String method;
    public Boolean cdOverride;
    public Boolean chatBanned;
    public String chatbanReason;
    public Boolean chatbanIsPerma;
    public Long chatbanExpiry;
    public Boolean renameRequested;
    public String discordName;
    public Number chatNameColor;

    public ServerUserInfo(String username, String login, String role, int pixelCount, int pixelCountAllTime,
                          Boolean banned, Long banExpiry, String ban_reason, String method, Boolean cdOverride,
                          Boolean chatBanned, String chatbanReason, Boolean chatbanIsPerma, Long chatbanExpiry,
                          Boolean renameRequested, String discordName, Number chatNameColor) {
        this.username = username;
        this.login = login;
        this.role = role;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banned = banned;
        this.banExpiry = banExpiry;
        this.ban_reason = ban_reason;
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

    public String getRole() {
        return role;
    }

    public Boolean getBanned() {
        return banned;
    }

    public Long getBanExpiry() {
        return banExpiry;
    }

    public String getBan_reason() {
        return ban_reason;
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
