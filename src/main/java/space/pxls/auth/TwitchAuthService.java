package space.pxls.auth;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

import kong.unirest.HttpResponse;
import kong.unirest.JsonNode;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import kong.unirest.json.JSONObject;
import space.pxls.App;
import space.pxls.auth.AuthService.InvalidAccountException;

public class TwitchAuthService extends AuthService {
	public TwitchAuthService(String id) {
	    super(id, App.getConfig().getBoolean("oauth.twitch.enabled"), App.getConfig().getBoolean("oauth.twitch.registrationEnabled"));
	}
	
	@Override
	public String getRedirectUrl(String state) {
		return "https://id.twitch.tv/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.twitch.key") + "&redirect_uri=" + getCallbackUrl() + "&response_type=code&scope=user:read:subscriptions user:read:follows&state=" + state;
	}
	
	@Override
	public String getToken(String code) throws UnirestException {
		HttpResponse<JsonNode> response = Unirest.post("https://id.twitch.tv/oauth2/token")
		.header("User-Agent", "pxls.space")
		.field("client_id", App.getConfig().getString("oauth.twitch.key"))
		.field("client_secret", App.getConfig().getString("oauth.twitch.secret"))
		.field("code", code)
		.field("grant_type", "authorization_code")
		.field("redirect_uri", getCallbackUrl())
		.asJson();
		
		JSONObject json = response.getBody().getObject();

		if (!json.has("access_token")) {
            return null;
        } else {
            return json.getString("access_token");
        }
	}
	
	@Override
	public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
	
		HttpResponse<JsonNode> userResponse = Unirest.get("https://api.twitch.tv/helix/users")
		.header("User-Agent", "pxls.space")
		.header("Authorization", "Bearer " + token)
		.header("Client-Id", App.getConfig().getString("oauth.twitch.key"))
		.asJson();
		
		if (!userResponse.isSuccess()) {
			return null;
		}
		
		JSONObject userData = userResponse.getBody().getObject().getJSONArray("data").getJSONObject(0);

		HttpResponse<JsonNode> followResponse = Unirest.get("https://api.twitch.tv/helix/channels/followed?broadcaster_id=" + App.getConfig().getString("oauth.twitch.broadcaster") + "&user_id=" + userData.getInt("id"))
		.header("User-Agent", "pxls.space")
		.header("Authorization", "Bearer " + token)
		.header("Client-Id", App.getConfig().getString("oauth.twitch.key"))
		.asJson();
		
		if (!followResponse.isSuccess()) {
			return null;
		}
		
		JSONObject followData = followResponse.getBody().getObject().getJSONArray("data").getJSONObject(0);
		
		long followMillis = Instant.parse(followData.getString("followed_at")).toEpochMilli();
		long currentMillis = System.currentTimeMillis() - followMillis;
		
		long minMillis = App.getConfig().getDuration("oauth.twitch.followAge", TimeUnit.MILLISECONDS);
        if (currentMillis < minMillis){
            throw new InvalidAccountException("Account too young");
        }

		return userData.getString("login");
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