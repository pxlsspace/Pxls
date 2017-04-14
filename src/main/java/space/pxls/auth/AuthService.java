package space.pxls.auth;

import com.mashape.unirest.http.exceptions.UnirestException;
import space.pxls.App;

public abstract class AuthService {
    private String id;

    public AuthService(String id) {
        this.id = id;
    }

    public abstract String getRedirectUrl();

    public String getCallbackUrl() {
        return App.getConfig().getString("oauth.callbackBase") + "/" + id;
    }

    public abstract String getToken(String code) throws UnirestException;

    public abstract String getIdentifier(String token) throws UnirestException, InvalidAccountException;

    public static class InvalidAccountException extends Exception {
        public InvalidAccountException(String s) {
            super(s);
        }
    }
}
