package space.pxls.auth;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import org.json.JSONObject;
import org.json.JSONException;
import space.pxls.App;

import java.util.concurrent.TimeUnit;

public class VKAuthService extends AuthService {
    public VKAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.vk.enabled"), App.getConfig().getBoolean("oauth.vk.registrationEnabled"));
    }

    public String getRedirectUrl(String state) {
        // we need to double-encode state because of the pingpong game
        try {
            state = URLEncoder.encode(URLEncoder.encode(state, "UTF-8"), "UTF-8");
        } catch (UnsupportedEncodingException e) {
            // do nothing
        }

        return "https://oauth.vk.com/authorize?" +
            "client_id=" + App.getConfig().getString("oauth.vk.key") +
            "&response_type=code" +
            "&redirect_uri=" + getCallbackUrl() +
            "&duration=temporary" +
            "&scope=status" +
            "&display=page" +
            "&state=" + state +
            "&v=5.64";
    }

    public String getToken(String code) throws UnirestException {
        HttpResponse<JsonNode> response = Unirest.post("https://oauth.vk.com/access_token")
                .header("User-Agent", "pxls.space")
                .field("grant_type", "authorization_code")
                .field("code", code)
                .field("redirect_uri", getCallbackUrl())
                .field("client_id", App.getConfig().getString("oauth.vk.key"))
                .field("client_secret", App.getConfig().getString("oauth.vk.secret"))
                .asJson();

        JSONObject json = response.getBody().getObject();

        if (json.has("error")) {
            return null;
        } else {
            return json.getString("access_token");
        }
    }

    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        HttpResponse<JsonNode> me = Unirest.get("https://api.vk.com/method/users.get?access_token=" + token + "&v=5.64")
                .header("User-Agent", "pxls.space")
                .asJson();
        JSONObject json = me.getBody().getObject();

        if (json.has("error")) {
            return null;
        } else {
            try {
                return Integer.toString(json.getJSONArray("response").getJSONObject(0).getInt("id"));
            } catch (JSONException e) {
                return null;
            }
        }
    }

    public String getName() {
        return "VK";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.vk.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.vk.registrationEnabled");
    }
}
