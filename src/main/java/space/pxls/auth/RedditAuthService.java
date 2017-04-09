package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.json.JSONObject;
import space.pxls.App;

public class RedditAuthService extends AuthService {
    public RedditAuthService(String id) {
        super(id);
    }

    public String getRedirectUrl() {
       return "https://www.reddit.com/api/v1/authorize?client_id=" + App.getConfig().getString("oauth.reddit.key") + "&response_type=code&redirect_uri=" + getCallbackUrl() + "&duration=temporary&scope=identity&state=potato";
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

    public String getIdentifier(String token) throws UnirestException {
        HttpResponse<JsonNode> me = Unirest.get("https://oauth.reddit.com/api/v1/me")
                .header("Authorization", "bearer " + token)
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();
        if (json.has("error")) {
            return null;
        } else {
            return json.getString("name");
        }
    }
}
