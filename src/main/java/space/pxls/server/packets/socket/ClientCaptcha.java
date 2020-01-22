package space.pxls.server.packets.socket;

public class ClientCaptcha {
    public String token;

    public ClientCaptcha(String token) {
        this.token = token;
    }

    public String getToken() {
        return token;
    }
}
