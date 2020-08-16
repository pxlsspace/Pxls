package space.pxls.server.packets.socket;

public class ClientBanMe {
    public String reason;

    public ClientBanMe(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }
}
