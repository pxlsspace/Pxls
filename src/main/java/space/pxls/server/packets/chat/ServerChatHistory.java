package space.pxls.server.packets.chat;

import java.util.List;

public class ServerChatHistory {
    public String type = "chat_history";
    public List<ChatMessage> messages;

    public ServerChatHistory(List<ChatMessage> messages) {
        this.messages = messages;
    }

    public String getType() {
        return type;
    }

    public List<ChatMessage> getMessages() {
        return messages;
    }
}
