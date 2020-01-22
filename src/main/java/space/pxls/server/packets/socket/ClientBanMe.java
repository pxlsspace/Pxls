package space.pxls.server.packets.socket;

public class ClientBanMe {
    public String app;

    public ClientBanMe(String app) {
        this.app = app;
    }

    public String getApp() {
        return app;
    }
}
