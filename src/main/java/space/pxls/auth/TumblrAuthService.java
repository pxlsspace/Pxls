package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.json.JSONObject;
import org.json.JSONException;
import space.pxls.App;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import java.util.concurrent.TimeUnit;

public class TumblrAuthService extends AuthService {
    public TumblrAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.tumblr.enabled"), App.getConfig().getBoolean("oauth.tumblr.registrationEnabled"));
    }

    private transient Map<String, String> tokens = new ConcurrentHashMap<String, String>();

    // OAuth1 doesn't have states.... (stuff is instead handled by oauth_token's)
    public String generateState() {
        return "";
    }

    public boolean verifyState(String state) {
        return true;
    }

    public String getRedirectUrl(String state) {
        try {
            HttpResponse<String> response = Unirest.get("https://www.tumblr.com/oauth/request_token?" + getOauthRequestToken("https://www.tumblr.com/oauth/request_token"))
                .header("User-Agent", "pxls.space")
                .asString();
            Map<String, String> query = parseQuery(response.getBody());
            if (!query.get("oauth_callback_confirmed").equals("true")) {
                return "/";
            }
            if (query.get("oauth_token") == null) {
                return "/";
            }
            tokens.put(query.get("oauth_token"), query.get("oauth_token_secret"));
            return "https://www.tumblr.com/oauth/authorize?oauth_token=" + query.get("oauth_token");
        } catch (UnirestException e) {
            return "/";
        }
    }

    public String getToken(String code) throws UnirestException {
        String[] codes = code.split("\\|");
        HttpResponse<String> response = Unirest.post("https://www.tumblr.com/oauth/access_token?" + getOauthAccessToken("https://www.tumblr.com/oauth/access_token", codes[0], codes[1], tokens.get(codes[0])))
            .header("User-Agent", "pxls.space")
            .asString();
        tokens.remove(codes[0]);
        Map<String, String> query = parseQuery(response.getBody());
        if (query.get("oauth_token") == null) {
            return null;
        }
        return query.get("oauth_token") + "|" + query.get("oauth_token_secret");
    }

    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        String[] codes = token.split("\\|");
        HttpResponse<JsonNode> me = Unirest.get("https://api.tumblr.com/v2/user/info?" + getOauthRequest("https://api.tumblr.com/v2/user/info", "oauth_token="+codes[0], "oob", "GET", codes[1]))
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();
        if (json.has("error")) {
            return null;
        } else {
            try {
                return json.getJSONObject("response").getJSONObject("user").getString("name");
            } catch (JSONException e) {
                return null;
            }
        }
    }

    public String getName() {
        return "Tumblr";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.tumblr.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.tumblr.registrationEnabled");
    }
}
