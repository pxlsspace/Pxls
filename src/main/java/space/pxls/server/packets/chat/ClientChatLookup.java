package space.pxls.server.packets.chat;

public class ClientChatLookup {
    public String who;

    public ClientChatLookup(String who) {
        this.who = who;
    }

    public String getWho() {
        return who;
    }
}
