package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.json.JSONObject;
import space.pxls.App;

public class DiscordAuthService extends AuthService {
    public DiscordAuthService(String id) {
        super(id);
    }

    public String getRedirectUrl() {
        return "https://discordapp.com/api/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.discord.key") + "&response_type=code&redirect_uri=" + getCallbackUrl() + "&duration=temporary&scope=identify&state=potato";
    }

    public String getToken(String code) throws UnirestException {
        HttpResponse<JsonNode> response = Unirest.post("https://discordapp.com/api/oauth2/token")
                .header("User-Agent", "pxls.space")
                .field("grant_type", "authorization_code")
                .field("code", code)
                .field("redirect_uri", getCallbackUrl())
                .basicAuth(App.getConfig().getString("oauth.discord.key"), App.getConfig().getString("oauth.discord.secret"))
                .asJson();

        JSONObject json = response.getBody().getObject();

        if (json.has("error")) {
            return null;
        } else {
            return json.getString("access_token");
        }
    }

    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        HttpResponse<JsonNode> me = Unirest.get("https://discordapp.com/api/users/@me")
                .header("Authorization", "Bearer " + token)
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();
        if (json.has("error")) {
            return null;
        } else {
//            long accountAgeSeconds = (System.currentTimeMillis() / 1000 - json.getLong("created"));
//            long minAgeSeconds = App.getConfig().getDuration("oauth.reddit.minAge", TimeUnit.SECONDS);
//            if (accountAgeSeconds < minAgeSeconds){
//                throw new InvalidAccountException("Account too young, must be " + minAgeSeconds / 86400 + " days old");
//            } else if (json.getBoolean("has_verified_email")) {
//                throw new InvalidAccountException("Account must have a verified e-mail");
//            }
            return json.getString("id");
        }
    }
}
