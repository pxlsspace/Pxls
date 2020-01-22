package space.pxls.server.packets.socket;

public class ClientShadowBanMe {
    public String app;
    public String z;

    public ClientShadowBanMe(String app, String z) {
        this.app = app;
        this.z = z;
    }

    public String getApp() {
        return app;
    }

    public String getZ() {
        return z;
    }
}
