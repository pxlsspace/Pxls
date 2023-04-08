package space.pxls.auth;

import kong.unirest.HttpResponse;
import kong.unirest.JsonNode;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import com.typesafe.config.Config;
import kong.unirest.json.JSONObject;
import space.pxls.App;

import java.util.List;

public class GoogleAuthService extends AuthService {
    public GoogleAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.google.enabled"), App.getConfig().getBoolean("oauth.google.registrationEnabled"));
    }

    Config config = App.getConfig();

    @Override
    public String getRedirectUrl(String state) {
        return "https://accounts.google.com/o/oauth2/v2/auth?" +
                "scope=profile%20email&" +
                "access_type=online&" +
                "include_granted_scopes=true&" +
                "state=" + state + "&" +
                "redirect_uri=" + getCallbackUrl() + "&" +
                "response_type=code&" +
                "client_id=" + App.getConfig().getString("oauth.google.key");
    }

    @Override
    public String getToken(String code) throws UnirestException {
        HttpResponse<JsonNode> response = Unirest.post("https://www.googleapis.com/oauth2/v4/token")
                .header("User-Agent", "pxls.space")
                .field("grant_type", "authorization_code")
                .field("code", code)
                .field("redirect_uri", getCallbackUrl())
                .field("client_id", App.getConfig().getString("oauth.google.key"))
                .field("client_secret", App.getConfig().getString("oauth.google.secret"))
                .asJson();

        JSONObject json = response.getBody().getObject();

        if (json.has("error")) {
            return null;
        } else {
            return json.getString("access_token");
        }
    }

    @Override
    public String getIdentifier(String token) throws UnirestException {
        HttpResponse<JsonNode> me = Unirest.get("https://www.googleapis.com/oauth2/v1/userinfo")
                .header("Authorization", "Bearer " + token)
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();
        if (json.has("error")) {
            return null;
        } else {
            if (!config.getBoolean("oauth.google.restrictions.enable")) {
                return json.getString("id");
            }
            if (!json.has("hd")) {
                return null;
            }
            String domain = json.getString("hd");
            boolean whitelist = config.getBoolean("oauth.google.restrictions.whitelist");
            List<String> domains = config.getStringList("oauth.google.restrictions.domains");
            if (domains.contains(domain) && whitelist) {
                return json.getString("id");
            } else {
                return null;
            }
        }
    }

    public String getName() {
        return "Google";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.google.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.google.registrationEnabled");
    }
}
