package space.pxls.server.packets.http;

public class AuthResponse {
    public String token;
    public Boolean signup;

    public AuthResponse(String token, Boolean signup) {
        this.token = token;
        this.signup = signup;
    }

    public String getToken() {
        return token;
    }

    public Boolean getSignup() {
        return signup;
    }
}
