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
        return "https://discord.com/api/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.discord.key") + "&response_type=code&redirect_uri=" + getCallbackUrl() + "&duration=temporary&scope=identify&state=" + state;
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
}
