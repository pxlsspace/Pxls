package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.json.JSONObject;
import space.pxls.App;

import java.util.concurrent.TimeUnit;

public class RedditAuthService extends AuthService {
    public RedditAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.reddit.enabled"), App.getConfig().getBoolean("oauth.reddit.registrationEnabled"));
    }

    public String getRedirectUrl(String state) {
        return "https://www.reddit.com/api/v1/authorize.compact?client_id=" + App.getConfig().getString("oauth.reddit.key") + "&response_type=code&redirect_uri=" + getCallbackUrl() + "&duration=temporary&scope=identity&state=" + state;
    }

    public String getToken(String code) throws UnirestException {
        HttpResponse<JsonNode> response = Unirest.post("https://www.reddit.com/api/v1/access_token")
                .header("User-Agent", "pxls.space")
                .field("grant_type", "authorization_code")
                .field("code", code)
                .field("redirect_uri", getCallbackUrl())
                .basicAuth(App.getConfig().getString("oauth.reddit.key"), App.getConfig().getString("oauth.reddit.secret"))
                .asJson();

        JSONObject json = response.getBody().getObject();

        if (json.has("error")) {
            return null;
        } else {
            return json.getString("access_token");
        }
    }

    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        HttpResponse<JsonNode> me = Unirest.get("https://oauth.reddit.com/api/v1/me")
                .header("Authorization", "bearer " + token)
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();
        if (json.has("error")) {
            return null;
        } else {
            long accountAgeSeconds = (System.currentTimeMillis() / 1000 - json.getLong("created"));
            long minAgeSeconds = App.getConfig().getDuration("oauth.reddit.minAge", TimeUnit.SECONDS);
            if (accountAgeSeconds < minAgeSeconds){
                long days = minAgeSeconds / 86400;
                throw new InvalidAccountException("Account too young");
            } else if (!json.getBoolean("has_verified_email")) {
                throw new InvalidAccountException("Account must have a verified e-mail");
            }
            return json.getString("name");
        }
    }

    public String getName() {
        return "Reddit";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.reddit.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.reddit.registrationEnabled");
    }
}
