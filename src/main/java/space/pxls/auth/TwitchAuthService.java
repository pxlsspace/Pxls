package space.pxls.auth;

import kong.unirest.HttpResponse;
import kong.unirest.JsonNode;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import kong.unirest.json.JSONObject;
import space.pxls.App;

public class TwitchAuthService extends AuthService {

    public TwitchAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.twitch.enabled"), App.getConfig().getBoolean("oauth.twitch.registrationEnabled"));
    }

    @Override
    public String getRedirectUrl(String state) {
        return "https://id.twitch.tv/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.twitch.key") + "&redirect_uri=" + getCallbackUrl() + "&response_type=code&state=" + state;
    }

    @Override
    public String getToken(String code) throws UnirestException {
        HttpResponse<JsonNode> httpResponse = Unirest.post("https://id.twitch.tv/oauth2/token")
                .header("User-Agent", "pxls.space")
                .field("client_id", App.getConfig().getString("oauth.twitch.key"))
                .field("client_secret", App.getConfig().getString("oauth.twitch.secret"))
                .field("code", code).field("grant_type", "authorization_code")
                .field("redirect_uri", getCallbackUrl())
                .asJson();

        JSONObject jsonObject = httpResponse.getBody().getObject();

        if (!jsonObject.has("access_token")) {
            return null;
        }

        return jsonObject.getString("access_token");
    }

    @Override
    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        HttpResponse<JsonNode> httpResponse = Unirest.get("https://api.twitch.tv/helix/users")
                .header("User-Agent", "pxls.space")
                .header("Authorization", "Bearer " + token)
                .header("Client-Id", App.getConfig().getString("oauth.twitch.key"))
                .asJson();

        if (!httpResponse.isSuccess()) {
            return null;
        }

        return httpResponse.getBody().getObject().getJSONArray("data").getJSONObject(0).getString("id");
    }

    @Override
    public String getName() {
        return "Twitch";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.twitch.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.twitch.registrationEnabled");
    }

}
