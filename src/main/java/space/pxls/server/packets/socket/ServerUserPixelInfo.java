package space.pxls.server.packets.socket;

public class ServerUserPixelInfo extends ServerUserInfo {
    public Integer pixels;
    public Integer pixelsAllTime;

    public ServerUserPixelInfo(String username, String role, String login, Boolean banned, Long banExpiry, String ban_reason,
                               Integer pixels, Integer pixelsAllTime, String method, Boolean cdOverride,
                               Boolean chatBanned, String chatbanReason, Boolean chatbanIsPerma, Long chatbanExpiry,
                               Boolean renameRequested, String discordName, Number chatNameColor) {
        super(username, role, login, banned, banExpiry, ban_reason, method, cdOverride, chatBanned, chatbanReason, chatbanIsPerma, chatbanExpiry, renameRequested, discordName, chatNameColor);
        this.pixels = pixels;
        this.pixelsAllTime = pixelsAllTime;
    }

    public Integer getPixels() {
        return pixels;
    }

    public Integer getPixelsAllTime() {
        return pixelsAllTime;
    }
}
