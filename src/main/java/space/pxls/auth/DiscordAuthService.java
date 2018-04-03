package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;

import org.json.JSONObject;
import space.pxls.App;

import java.util.concurrent.TimeUnit;

public class DiscordAuthService extends AuthService {
    public DiscordAuthService() {
        super("discord", "Discord");
    }

    public String getRedirectUrl(String state) {
        return "https://discordapp.com/api/oauth2/authorize?client_id=" + App.getConfig().getString("oauth.discord.key") + "&response_type=code&redirect_uri=" + getCallbackUrl() + "&duration=temporary&scope=identify&state=" + state;
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
            long id = json.getLong("id");
            long signupTimeMillis = (id >> 22) + 1420070400000L;
            long ageMillis = System.currentTimeMillis() - signupTimeMillis;

            long minAgeMillis = App.getConfig().getDuration("oauth.discord.minAge", TimeUnit.MILLISECONDS);
            if (ageMillis < minAgeMillis){
                throw new InvalidAccountException("Account too young");
            }
            return json.getString("id");
        }
    }
}
