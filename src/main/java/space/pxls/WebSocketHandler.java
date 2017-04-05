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

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@WebSocket
public class WebSocketHandler {
    private Gson gson = new Gson();

    private Map<String, GameSessionData> sessionData = new ConcurrentHashMap<>();
    private Set<Session> sessions = ConcurrentHashMap.newKeySet();

    @OnWebSocketConnect
    public void connected(Session session) throws IOException {
        String ip = getIP(session);

        checkBanned(session);

        sessionData.putIfAbsent(ip, new GameSessionData());
        sessions.add(session);

        sendWaitTime(session);
    }

    private boolean checkBanned(Session session) {
        String ip = getIP(session);
        if (App.getBannedIps().contains(ip)) {
            App.getLogger().info("Banned IP {} tried to connect", ip);
            send(session, new Data.ServerAlert("Due to abuse, this IP address has been banned from placing pixels"));
            return true;
        } else if (App.getTorIps().contains(ip)) {
            App.getLogger().info("Tor IP {} tried to connect", ip);
            send(session, new Data.ServerAlert("Due to widespread abuse, Tor IP addresses have been banned from placing pixels"));
            return true;
        }
        return false;
    }

    @OnWebSocketMessage
    public void message(Session session, String message) throws IOException, UnirestException {
        JsonObject rawObject = gson.fromJson(message, JsonObject.class);
        String type = rawObject.get("type").getAsString();

        if (type.equals("place")) {
            if (checkBanned(session)) return;

            Data.ClientPlace cp = gson.fromJson(rawObject, Data.ClientPlace.class);
            doPlace(session, cp);
        } else if (type.equals("captcha")) {
            Data.ClientCaptcha cc = gson.fromJson(rawObject, Data.ClientCaptcha.class);
            doCaptcha(session, cc);
        }
    }

    private void doCaptcha(Session session, Data.ClientCaptcha cc) throws UnirestException {
        GameSessionData data = getSessionData(session);
        if (data.captchalessPlacesRemaining > 0) return;

        boolean success = verifyCaptcha(session, cc.token);
        if (success) {
            data.captchalessPlacesRemaining = App.getCaptchaThreshold();
        }
        send(session, new Data.ServerCaptchaStatus(success));
    }

    private void doPlace(Session session, Data.ClientPlace cp) throws IOException {
        String ip = getIP(session);
        GameSessionData data = getSessionData(session);

        int x = cp.x;
        int y = cp.y;
        int color = cp.color;

        if (x < 0 || x >= App.getGame().getWidth() || y < 0 || y >= App.getGame().getHeight() || color < 0 || color >= App.getGame().getPalette().size())
            return;

        boolean trusted = App.getTrustedIps().contains(ip);

        float waitTime = App.getGame().getWaitTime(data.lastPlace);

        if (waitTime <= 0 || trusted) {
            if (!trusted && data.captchalessPlacesRemaining <= 0) {
                send(session, new Data.ServerCaptchaNeeded());
                return;
            } else {
                if (App.getGame().getPixel(x, y) == color) return;
                App.getGame().setPixel(x, y, (byte) color);

                App.saveBoard();
                App.logPixel(ip, x, y, color);

                Data.ServerPlace sp = new Data.ServerPlace(x, y, color);
                broadcast(sp);

                data.lastPlace = System.currentTimeMillis();
                if (!trusted) data.captchalessPlacesRemaining--;
            }
        }

        sendWaitTime(session);
    }

    @OnWebSocketClose
    public void closed(Session session, int statusCode, String reason) {
        sessions.remove(session);
    }

    private void sendWaitTime(Session session) {
        GameSessionData sd = getSessionData(session);
        String ip = getIP(session);

        float waitTime = App.getGame().getWaitTime(sd.lastPlace);
        if (App.getTrustedIps().contains(ip)) waitTime = 0;
        send(session, new Data.ServerCooldown(waitTime));
    }

    private String getIP(Session session) {
        String ip = session.getRemoteAddress().getAddress().getHostAddress();
        if (session.getUpgradeRequest().getHeader("X-Forwarded-For") != null) {
            ip = session.getUpgradeRequest().getHeader("X-Forwarded-For");
        }
        return ip;
    }

    private boolean verifyCaptcha(Session sess, String token) throws UnirestException {
        String secret = App.getReCaptchaSecret();
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
        return body.getBoolean("success") && body.getString("hostname").equalsIgnoreCase(sess.getUpgradeRequest().getHost());
    }

    public void send(Session sess, Object obj) {
        if (sess.isOpen()) {
            try {
                sess.getRemote().sendStringByFuture(gson.toJson(obj));
            } catch (RuntimeException e) {
                App.getLogger().error("Error while sending message to client", e);
            }
        }
    }

    public void broadcast(Object obj) {
        for (Session session : sessions) {
            send(session, obj);
        }
    }

    public Set<Session> getSessions() {
        return sessions;
    }

    public GameSessionData getSessionData(Session session) {
        return sessionData.get(getIP(session));
    }
}