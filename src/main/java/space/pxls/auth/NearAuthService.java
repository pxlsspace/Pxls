package space.pxls.auth;

import com.mashape.unirest.http.exceptions.UnirestException;
import space.pxls.App;

public class NearAuthService extends AuthService {

    public NearAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.near.enabled"), App.getConfig().getBoolean("oauth.near.registrationEnabled"));
    }

    @Override
    public void reloadEnabledState() {

    }

    @Override
    public String getRedirectUrl(String state) {
        return null;
    }

    @Override
    public String getToken(String code) throws UnirestException {
        return null;
    }

    @Override
    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        return null;
    }

    @Override
    public String getName() {
        return "NEAR";
    }

    @Override
    public String generateState() {
        return "";
    }

    @Override
    public boolean verifyState(String state) {
        return true;
    }
}
