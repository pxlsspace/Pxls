package space.pxls.server.packets.chat;

public class ClientChatLookup {
    public String arg;
    public String mode;

    public ClientChatLookup(String arg, String mode) {
        this.arg = arg;
        this.mode = mode;
    }

    public String getArg() {
        return arg;
    }

    public String getMode() {
        return mode;
    }
}
