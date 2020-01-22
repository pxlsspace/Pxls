package space.pxls.server.packets.chat;

public class ServerChatCooldown {
    public String type = "message_cooldown";
    public Integer diff;
    public String message;

    public ServerChatCooldown(Integer diff, String message) {
        this.diff = diff;
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public Integer getDiff() {
        return diff;
    }

    public String getMessage() {
        return message;
    }
}
