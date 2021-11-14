package space.pxls.auth;

import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.json.JSONObject;
import space.pxls.App;
import space.pxls.server.WebHandler;

import java.net.*;

public class OpenIDAuthService extends AuthService {
    private final URL issuer;
    private final URI authEndpoint;
    private final URI tokenEndpoint;
    private final URI userinfoEndpoint;

    public OpenIDAuthService(String id)
        throws
            MalformedURLException,
            URISyntaxException,
            UnirestException
    {
        // TODO: there's almost certainly a library that can do all of this
        // discovery automatically and in a better way (support of algos, etc.)
        issuer = new URL(App.getConfig().getString("auth.issuer") + "/");

        URI configUrl = issuer.toURI()
                .resolve(".well-known/openid-configuration");

        JSONObject info = Unirest.get(configUrl.toString())
                .header("User-Agent", "pxls.space")
                .asJson()
                .getBody()
                .getObject();

        // resolve nicely in case a returned URI is relative
        authEndpoint = configUrl.resolve(info.getString("authorization_endpoint") + "/");
        tokenEndpoint = configUrl.resolve(info.getString("token_endpoint") + "/");
        userinfoEndpoint = configUrl.resolve(info.getString("userinfo_endpoint") + "/");
    }

    public String getRedirectUrl(String state) {
        String scopes = App.getConfig().getString("auth.scopes");

        return authEndpoint.resolve(
            "?client_id=" + App.getConfig().getString("auth.client") +
            "&response_type=code" +
            "&redirect_uri=" + WebHandler.encodedURIComponent(getCallbackUrl()) +
            (scopes.isEmpty() ? "" : ("&scope=" + scopes)) +
            "&state=" + WebHandler.encodedURIComponent(state)
        ).toString();
    }

    public String getToken(String code) throws UnirestException {
        JSONObject userinfo = Unirest.post(tokenEndpoint.toString())
                .header("User-Agent", "pxls.space")
                .field("grant_type", "authorization_code")
                .field("code", code)
                .field("redirect_uri", getCallbackUrl())
                .basicAuth(App.getConfig().getString("auth.client"), App.getConfig().getString("auth.secret"))
                .asJson()
                .getBody()
                .getObject();

        if (userinfo.has("error")) {
            return null;
        } else {
            return userinfo.getString("access_token");
        }
    }

    public String getIdentifier(String token) throws UnirestException, InvalidAccountException {
        JSONObject me = Unirest.get(userinfoEndpoint.toString())
                .header("User-Agent", "pxls.space")
                .header("Authorization", "Bearer " + token)
                .asJson()
                .getBody()
                .getObject();
        if (me.has("error")) {
            return null;
        } else {
            // "sub" is short of "subject" in case you were curious
            return me.getString("sub");
        }
    }
}
