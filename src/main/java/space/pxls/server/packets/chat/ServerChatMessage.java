package space.pxls.server.packets.chat;

public class ServerChatMessage {
    public String type = "chat_message";
    public ChatMessage message;

    public ServerChatMessage(ChatMessage message) {
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public ChatMessage getMessage() {
        return message;
    }
}
