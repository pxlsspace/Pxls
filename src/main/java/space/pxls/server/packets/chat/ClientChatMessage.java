package space.pxls.server.packets.chat;

public class ClientChatMessage {
    public String message;

    public ClientChatMessage(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
}
