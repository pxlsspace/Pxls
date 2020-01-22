package space.pxls.server.packets.chat;

public class ServerChatBan {
    public String type = "chat_ban";
    public Boolean permanent;
    public String reason;
    public Long expiry;

    public ServerChatBan(Boolean permanent, String reason, Long expiry) {
        this.permanent = permanent;
        this.reason = reason;
        this.expiry = expiry;
    }

    public String getType() {
        return type;
    }

    public Boolean getPermanent() {
        return permanent;
    }

    public String getReason() {
        return reason;
    }

    public Long getExpiry() {
        return expiry;
    }
}
