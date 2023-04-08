package space.pxls.server.packets.chat;

public class ServerChatMessageBlocked {
    public String type = "chat_message_blocked";
    public String message;

    public ServerChatMessageBlocked(String message) {
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public String getMessage() {
        return message;
    }
}
