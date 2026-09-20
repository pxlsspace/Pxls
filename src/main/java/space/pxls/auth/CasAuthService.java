package space.pxls.auth;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import kong.unirest.HttpResponse;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import space.pxls.App;

public class CasAuthService extends AuthService {
    public CasAuthService(String id) {
        super(id, App.getConfig().getBoolean("oauth.cas.enabled"), App.getConfig().getBoolean("oauth.cas.registrationEnabled"));
    }

    @Override
    public String getRedirectUrl(String state) {
        try {
            state = URLEncoder.encode(state, StandardCharsets.UTF_8.toString());
        } catch (UnsupportedEncodingException e) {
            return "";
        }
        String service = getCallbackUrl() + "?state=" + state;
        try {
            service = URLEncoder.encode(service, StandardCharsets.UTF_8.toString());
        } catch (UnsupportedEncodingException e) {
            return "";
        }
        return App.getConfig().getString("oauth.cas.loginUrl") + "?service=" + service;
    }

    @Override
    public String getToken(String token) throws UnirestException {
        HttpResponse<String> response = Unirest.get(App.getConfig().getString("oauth.cas.validateUrl"))
            .queryString("service", getCallbackUrl())
            .queryString("ticket", token)
            .asString();

        if (response.getStatus() != 200) {
            throw new UnirestException("CAS validation failed: " + response.getStatusText());
        }

        String username;
        try {
            String start_username_field = "<cas:" + App.getConfig().getString("oauth.cas.usernameField") + ">";
            String end_username_field = "</cas:" + App.getConfig().getString("oauth.cas.usernameField") + ">";
            username = response.getBody().split(start_username_field)[1].split(end_username_field)[0];
        } catch (Exception e) {
            throw new UnirestException("CAS validation failed: " + e.getMessage());
        }

        return username;
    }

    @Override
    public String getIdentifier(String token) throws UnirestException {
        return token;
    }

    public String getName() {
        try {
            String custom_name = App.getConfig().getString("oauth.cas.name");
            if (custom_name != null && !custom_name.isEmpty()) {
                return custom_name;
            }
        } catch (Exception e) {
            // ignore
        }
        return "CAS";
    }

    @Override
    public void reloadEnabledState() {
        this.enabled = App.getConfig().getBoolean("oauth.cas.enabled");
        this.registrationEnabled = App.getConfig().getBoolean("oauth.cas.registrationEnabled");
    }
}
