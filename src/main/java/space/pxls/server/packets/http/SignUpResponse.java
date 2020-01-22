package space.pxls.server.packets.http;

public class SignUpResponse {
    public String url;

    public SignUpResponse(String url) {
        this.url = url;
    }

    public String getUrl() {
        return url;
    }
}
