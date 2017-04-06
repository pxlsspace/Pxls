package space.pxls;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import org.json.JSONObject;
import org.slf4j.MarkerFactory;
import spark.Request;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@WebSocket
public class WebSocketHandler {
    private Gson gson = new Gson();

    private Set<Session> sessions = ConcurrentHashMap.newKeySet();

    private long lastUserCountSent;

    @OnWebSocketConnect
    public void connected(Session session) throws IOException {
        String ip = getIP(session);

        checkBanned(session);

        Profile sess = getSessionData(session);
        sess.mustFillOutCaptcha = true;
        sessions.add(session);

        sendWaitTime(session);

        send(session, new Data.ServerUsers(sessions.size()));
        updateUserCount();
    }

    private void updateUserCount() {
        if (lastUserCountSent + 5000 > System.currentTimeMillis()) return;
        lastUserCountSent = System.currentTimeMillis();

        broadcast(new Data.ServerUsers(sessions.size()));
    }

    private boolean checkBanned(Session session) {
        String ip = getIP(session);
        if (getSessionData(session).role == Role.BANNED) {
            App.getLogger().info("Banned IP {} tried to connect", ip);
            send(session, new Data.ServerAlert("Due to abuse, this IP address has been banned from placing pixels"));
            return true;
        } else if (App.shouldBanTor() && App.getTorIps().contains(ip)) {
            App.getLogger().info("Tor IP {} tried to connect", ip);
            send(session, new Data.ServerAlert("Due to widespread abuse, Tor IP addresses have been banned from placing pixels"));
            return true;
        }
        return false;
    }

    @OnWebSocketMessage
    public void message(Session session, String message) throws IOException, UnirestException {
        JsonObject rawObject = gson.fromJson(message, JsonObject.class);
        if (!rawObject.has("type")) return;

        String type = rawObject.get("type").getAsString();

        if (type.equals("placepixel")) {
            if (checkBanned(session)) return;

            Data.ClientPlace cp = gson.fromJson(rawObject, Data.ClientPlace.class);
            doPlace(session, cp);
        } else if (type.equals("captcha")) {
            Data.ClientCaptcha cc = gson.fromJson(rawObject, Data.ClientCaptcha.class);
            doCaptcha(session, cc);
        } else if (type.equals("place")) {
            Data.ClientPlace cp = gson.fromJson(rawObject, Data.ClientPlace.class);
            App.getLogger().info("SUSPICIOUS: {} is possible bot, tried to place {} at {},{}", getIP(session), cp.color, cp.x, cp.y);
        } else if (type.equals("admin_cdoverride")) {
            Profile p = getSessionData(session);
            if (p.role.ordinal() < Role.TRUSTED.ordinal()) {
                App.getLogger().info("IP {} tried to override cooldown, no perms", getIP(session));
                return;
            }

            Data.ClientSetCooldownOverride csco = gson.fromJson(rawObject, Data.ClientSetCooldownOverride.class);
            p.overrideCooldown = csco.override;
            sendWaitTime(session);
        }
    }

    private void doCaptcha(Session session, Data.ClientCaptcha cc) throws UnirestException {
        Profile data = getSessionData(session);
        if (!data.mustFillOutCaptcha) return;

        boolean success = verifyCaptcha(session, cc.token);
        if (success) {
            data.mustFillOutCaptcha = false;
            data.justCaptchaed = true;
        }
        send(session, new Data.ServerCaptchaStatus(success));
    }

    private void doPlace(Session session, Data.ClientPlace cp) throws IOException {
        String ip = getIP(session);
        Profile data = getSessionData(session);

        int x = cp.x;
        int y = cp.y;
        int color = cp.color;

        if (x < 0 || x >= App.getGame().getWidth() || y < 0 || y >= App.getGame().getHeight() || color < 0 || color >= App.getGame().getPalette().size())
            return;

        boolean trusted = data.role.ordinal() >= Role.TRUSTED.ordinal();

        float waitTime = App.getGame().getWaitTime(data.lastPlace);

        if (!data.justCaptchaed) updateCaptchaState(data, trusted);

        if (waitTime <= 0 || data.overrideCooldown) {
            if (data.mustFillOutCaptcha) {
                App.getLogger().debug("IP {} must fill out captcha, rejecting place request", ip);
                send(session, new Data.ServerCaptchaNeeded());
                return;
            } else {
                if (App.getGame().getPixel(x, y) == color) return;
                App.getGame().setPixel(x, y, (byte) color, ip);

                Data.ServerPlace sp = new Data.ServerPlace(x, y, color);
                broadcast(sp);

                data.lastPlace = System.currentTimeMillis();

                if (data.overrideCooldown) {
                    App.getLogger().debug("IP {} overrode cooldown and placed pixel", ip);
                }

                data.justCaptchaed = false;
            }
        }

        sendWaitTime(session);
    }

    private void updateCaptchaState(Profile data, boolean trusted) {
        boolean last = data.mustFillOutCaptcha;

        // Show captcha every 1/x times
        if (!data.mustFillOutCaptcha && !data.justCaptchaed) {
            data.mustFillOutCaptcha = Math.random() < (1 / App.getGame().getConfig().getInt("captcha.threshold"));
        }

        if (data.lastPlace + 15 * 60 * 1000 < System.currentTimeMillis()) data.mustFillOutCaptcha = true;
        if (data.flagged) data.mustFillOutCaptcha = true;

        // ...except
        // if we *just* filled one in (and haven't placed yet)
        // or if user is trusted
        // or if captchas are disabled
        // ...then we don't
        if (trusted) data.mustFillOutCaptcha = false;
        if (App.getGame().getConfig().getString("captcha.secret") == null) data.mustFillOutCaptcha = false;

        if (data.mustFillOutCaptcha && !last) {
            App.getLogger().debug("Flagging {} for captcha", data.ip);
        }
    }

    @OnWebSocketClose
    public void closed(Session session, int statusCode, String reason) {
        sessions.remove(session);
    }

    private void sendWaitTime(Session session) {
        Profile sd = getSessionData(session);
        String ip = getIP(session);

        float waitTime = App.getGame().getWaitTime(sd.lastPlace);
        if (sd.overrideCooldown) waitTime = 0;
        send(session, new Data.ServerCooldown(waitTime));
    }

    public String getIP(Request request) {
        String ip = request.ip();
        if (request.headers("X-Forwarded-For") != null) {
            ip = request.headers("X-Forwarded-For");
        }
        return ip;
    }

    public String getIP(Session session) {
        String ip = session.getRemoteAddress().getAddress().getHostAddress();
        if (session.getUpgradeRequest().getHeader("X-Forwarded-For") != null) {
            ip = session.getUpgradeRequest().getHeader("X-Forwarded-For");
        }
        return ip;
    }

    private boolean verifyCaptcha(Session sess, String token) throws UnirestException {
        App.getLogger().debug("Verifying captcha from {} with token {}", getIP(sess), token);
        String secret = App.getGame().getConfig().getString("captcha.secret");
        if (secret == null || secret.isEmpty()) {
            App.getLogger().warn("No ReCaptcha secret key stored, BLINDLY AUTHENTICATING(!)");
            return true;
        }

        HttpResponse<JsonNode> resp = Unirest
                .post("https://www.google.com/recaptcha/api/siteverify")
                .field("secret", secret)
                .field("response", token)
                .field("remoteip", getIP(sess))
                .asJson();

        JSONObject body = resp.getBody().getObject();
        boolean success = body.getBoolean("success") && body.getString("hostname").equalsIgnoreCase(sess.getUpgradeRequest().getHost());
        App.getLogger().debug("Captcha from {} with token {}: {}", getIP(sess), token, success ? "successful" : "denied");
        return success;
    }

    public void sendRaw(Session sess, String data) {
        if (sess.isOpen()) {
            try {
                sess.getRemote().sendStringByFuture(data);
            } catch (RuntimeException e) {
                App.getLogger().error("Error while sending message to client", e);
            }
        }
    }

    public void send(Session sess, Object obj) {
        sendRaw(sess, gson.toJson(obj));
    }

    public void broadcast(Object obj) {
        String raw = gson.toJson(obj);
        for (Session session : sessions) {
            sendRaw(session, raw);
        }
    }

    public Set<Session> getSessions() {
        return sessions;
    }

    public Profile getSessionData(Session session) {
        return getSessionData(getIP(session));
    }

    public Profile getSessionData(String ip) {
        return App.getGame().getProfile(ip);
    }
}