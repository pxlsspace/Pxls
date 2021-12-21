package space.pxls.auth;

import com.mashape.unirest.http.exceptions.UnirestException;
import java.nio.charset.StandardCharsets;
import space.pxls.App;

import java.util.Map;
import java.util.LinkedHashMap;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.net.URLDecoder;
import org.apache.commons.codec.binary.Base64;
import space.pxls.util.Util;

import java.security.NoSuchAlgorithmException;
import java.security.InvalidKeyException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public abstract class AuthService {
    private final String id;
    private final transient Set<String> validStates = ConcurrentHashMap.newKeySet();
    protected transient boolean enabled;
    protected boolean registrationEnabled;

    protected AuthService(String id, boolean enabled, boolean registrationEnabled) {
        this.id = id;
        this.enabled = enabled;
        this.registrationEnabled = registrationEnabled;
    }

    public String generateState() {
        String s = Util.generateRandomToken();
        validStates.add(s);
        return s;
    }

    public abstract void reloadEnabledState();

    protected static Map<String, String> parseQuery(String query) {
        Map<String, String> queryPairs = new LinkedHashMap<>();
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            queryPairs.put(
                URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8),
                URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8)
            );
        }
        return queryPairs;
    }

    private String getOauthSignature(String url, String params, String secret, String method) {
        try {
            String base = method + "&" + url + "&" + params;

            // yea, don't ask me why, it is needed to append a "&" to the end of
            // secret key.
            String privKey = App.getConfig().getString("oauth."+id+".secret") + "&" + secret;

            SecretKey key = new SecretKeySpec(privKey.getBytes(StandardCharsets.UTF_8), "HmacSHA1");

            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(key);

            // encode it, base64 it, change it to string and return.
            return new String(new Base64().encode(mac.doFinal(base.getBytes(
                StandardCharsets.UTF_8))), StandardCharsets.UTF_8).trim();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            return "";
        }
    }

    protected String getOauthRequest(String url, String params, String callback, String method, String key) {
        String returnValue = "oauth_callback=" + URLEncoder.encode(callback, StandardCharsets.UTF_8) +
            "&oauth_consumer_key=" + URLEncoder.encode(App.getConfig().getString("oauth."+id+".key"),
            StandardCharsets.UTF_8) +
            "&oauth_nonce=" + Math.random() * 100000000 +
            "&oauth_signature_method=HMAC-SHA1" +
            "&oauth_timestamp=" + System.currentTimeMillis() / 1000;
        if (!params.isEmpty()) {
            returnValue += "&" + params;
        }
        returnValue += "&oauth_version=1.0";
        String signature = getOauthSignature(URLEncoder.encode(url, StandardCharsets.UTF_8), URLEncoder.encode(params,
            StandardCharsets.UTF_8), key, method);
        returnValue += "&oauth_signature=" + URLEncoder.encode(signature, StandardCharsets.UTF_8);
        return returnValue;
    }

    protected String getOauthRequestToken(String url) {
        return getOauthRequest(url, "", getCallbackUrl(), "GET", "");
    }

    protected String getOauthAccessToken(String url, String token, String verifier, String secret) {
        String params = "oauth_token=" + URLEncoder.encode(token, StandardCharsets.UTF_8) +
            "&oauth_verifier=" + URLEncoder.encode(verifier, StandardCharsets.UTF_8);
        return getOauthRequest(url, params, "oob", "POST", secret);
    }

    public boolean verifyState(String state) {
        return validStates.remove(state);
    }

    public abstract String getRedirectUrl(String state);

    public String getCallbackUrl() {
        return App.getConfig().getString("oauth.callbackBase") + "/" + id;
    }

    public abstract String getToken(String code) throws UnirestException;

    public abstract String getIdentifier(String token) throws UnirestException, InvalidAccountException;

    public static class InvalidAccountException extends Exception {
        public InvalidAccountException(String s) {
            super(s);
        }
    }

    public boolean use() {
        return enabled && !App.getConfig().getString("oauth."+id+".key").isEmpty();
    }

    public abstract String getName();

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isRegistrationEnabled() {
        return registrationEnabled;
    }
}
