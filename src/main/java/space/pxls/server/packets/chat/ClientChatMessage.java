package space.pxls.server.packets.chat;

public class ClientChatMessage {
    public String message;
    public int replyingToId;

    public ClientChatMessage(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
    
    public int getReplyingToId() {
        return replyingToId;
    }
}
