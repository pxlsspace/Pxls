package space.pxls.server.packets.chat;

import space.pxls.data.DBChatMessage;
import space.pxls.data.DBExtendedChatban;
import space.pxls.data.DBUser;

import java.util.List;

public class ServerChatLookup {
    public DBUser target;
    public List<DBChatMessage> history;
    public List<DBExtendedChatban> chatbans;
    public String type = "chat_lookup";

    public ServerChatLookup(DBUser target, List<DBChatMessage> history, List<DBExtendedChatban> chatbans) {
        this.target = target;
        this.history = history;
        this.chatbans = chatbans;
    }

    public DBUser getTarget() {
        return target;
    }

    public List<DBChatMessage> getHistory() {
        return history;
    }

    public List<DBExtendedChatban> getChatbans() {
        return chatbans;
    }

    public String getType() {
        return type;
    }
}
