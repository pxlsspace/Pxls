package space.pxls.server.packets.socket;

public class ClientShadowBanMe {
    public String reason;

    public ClientShadowBanMe(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }
}
