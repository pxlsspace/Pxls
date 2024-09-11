package space.pxls.auth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
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
        return "https://id.twitch.tv/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.twitch.key") + "&redirect_uri=" + getCallbackUrl() + "&response_type=code&state=" + state + "&scope=user:read:subscriptions";
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
        TwitchUserData userData = getUserData(token);
        return userData.id;
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

    public TwitchUserData getUserData(String token) throws UnirestException, InvalidAccountException {
        HttpResponse<String> httpResponse = Unirest.get("https://api.twitch.tv/helix/users")
                .header("User-Agent", "pxls.space")
                .header("Authorization", "Bearer " + token)
                .header("Client-Id", App.getConfig().getString("oauth.twitch.key"))
                .asString();

        if (!httpResponse.isSuccess()) {
            return null;
        }

        Gson gson = new Gson();
        return gson.fromJson(httpResponse.getBody(), TwitchUserDataResponse.class).data[0];
    }

    public TwitchUserSubscriptionData getUserSubscription(String token, String broadcasterId, String userId) {
        String url = String.format("https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=%s&user_id=%s", broadcasterId, userId);
        HttpResponse<String> httpResponse = Unirest.get(url)
                .header("User-Agent", "pxls.space")
                .header("Authorization", "Bearer " + token)
                .header("Client-Id", App.getConfig().getString("oauth.twitch.key"))
                .asString();

        if (!httpResponse.isSuccess()) {
            return null;
        }

        Gson gson = new Gson();
        return gson.fromJson(httpResponse.getBody(), TwitchUserSubscriptionDataResponse.class).data[0];
    }

    private record TwitchUserDataResponse(TwitchUserData[] data) { }
    public record TwitchUserData(String id, String login, String display_name, String created_at) { }

    private record TwitchUserSubscriptionDataResponse(TwitchUserSubscriptionData[] data) { }
    public record TwitchUserSubscriptionData(String broadcaster_id, String broadcaster_name, String broadcaster_login, Boolean is_gift, String tier) { }
}
