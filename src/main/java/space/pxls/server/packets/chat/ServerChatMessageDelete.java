package space.pxls.server.packets.chat;

public class ServerChatMessageDelete {
    public String type = "message_delete";
    public Integer id;

    public String getType() {
        return type;
    }

    public Integer getId() {
        return id;
    }
}
