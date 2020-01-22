package space.pxls.server.packets.http;

public class SignInResponse {
    public String url;

    public SignInResponse(String url) {
        this.url = url;
    }

    public String getUrl() {
        return url;
    }
}
