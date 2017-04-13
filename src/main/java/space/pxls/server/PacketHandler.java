package space.pxls.server;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.async.Callback;
import com.mashape.unirest.http.exceptions.UnirestException;
import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.IPReader;
import space.pxls.util.Timer;

import java.util.Collections;

public class PacketHandler {
    private UndertowServer server;
    private Timer userData = new Timer(5);

    public PacketHandler(UndertowServer server) {
        this.server = server;
    }

    public void connect(WebSocketChannel channel, User user) {
        if (user != null) {
            server.send(channel, new Packet.ServerUserInfo(user.getName(), user.isBanned(), user.isBanned() ? user.getBanExpiryTime() : null));
            sendCooldownData(channel, user);
            user.flagForCaptcha();
        }

        updateUserData();
    }

    public void disconnect(WebSocketChannel channel, User user) {
        updateUserData();
    }

    public void accept(WebSocketChannel channel, User user, Object obj, String ip) {
        if (user != null) {
            if (obj instanceof Packet.ClientPlace) handlePlace(channel, user, ((Packet.ClientPlace) obj), ip);
            if (obj instanceof Packet.ClientCaptcha) handleCaptcha(channel, user, ((Packet.ClientCaptcha) obj));
            if (obj instanceof Packet.ClientBanMe) handleBanMe(channel, user, ((Packet.ClientBanMe) obj));

            if (user.getRole().greaterEqual(Role.MODERATOR)) {
                if (obj instanceof Packet.ClientAdminCooldownOverride) handleCooldownOverride(channel, user, ((Packet.ClientAdminCooldownOverride) obj));
            }
        }
    }

    private void handleBanMe(WebSocketChannel channel, User user, Packet.ClientBanMe obj) {
        App.getUserManager().banUser(user, 86400);
    }

    private void handleCooldownOverride(WebSocketChannel channel, User user, Packet.ClientAdminCooldownOverride obj) {
        user.setOverrideCooldown(obj.override);
        sendCooldownData(channel, user);
    }

    private void handlePlace(WebSocketChannel channel, User user, Packet.ClientPlace cp, String ip) {
        if (cp.x < 0 || cp.x >= App.getWidth() || cp.y < 0 || cp.y >= App.getHeight()) return;
        if (cp.color < 0 || cp.color >= App.getConfig().getStringList("board.palette").size()) return;
        if (user.isBanned()) return;

        if (user.canPlace()) {
            if (user.updateCaptchaFlagPrePlace() && App.isCaptchaEnabled()) {
                server.send(channel, new Packet.ServerCaptchaRequired());
            } else {
                if (App.getPixel(cp.x, cp.y) != cp.color) {
                    boolean mod_action = user.isOverridingCooldown();
                    App.putPixel(cp.x, cp.y, cp.color, user, mod_action, ip);
                    App.saveMap();
                    broadcastPixelUpdate(cp.x, cp.y, cp.color);

                    if (!user.isOverridingCooldown())
                        user.resetCooldown();
                }
            }
        }

        sendCooldownData(channel, user);
    }

    private void handleCaptcha(WebSocketChannel channel, User user, Packet.ClientCaptcha cc) {
        if (!user.isFlaggedForCaptcha()) return;
        if (user.isBanned()) return;

        Unirest
                .post("https://www.google.com/recaptcha/api/siteverify")
                .field("secret", App.getConfig().getString("captcha.secret"))
                .field("response", cc.token)
                .field("remoteip", "null")
                .asJsonAsync(new Callback<JsonNode>() {
                    @Override
                    public void completed(HttpResponse<JsonNode> response) {
                        JsonNode body = response.getBody();

                        String hostname = App.getConfig().getString("captcha.host");

                        boolean success = body.getObject().getBoolean("success") && body.getObject().getString("hostname").equals(hostname);
                        if (success) {
                            user.validateCaptcha();
                        }

                        server.send(channel, new Packet.ServerCaptchaStatus(success));
                    }

                    @Override
                    public void failed(UnirestException e) {

                    }

                    @Override
                    public void cancelled() {

                    }
                });
    }

    private void updateUserData() {
        userData.run(() -> {
            server.broadcast(new Packet.ServerUsers(server.getConnections().size()));
        });
    }

    private void sendCooldownData(WebSocketChannel channel, User user) {
        server.send(channel, new Packet.ServerCooldown(user.getRemainingCooldown()));
    }

    private void broadcastPixelUpdate(int x, int y, int color) {
        server.broadcast(new Packet.ServerPlace(Collections.singleton(new Packet.ServerPlace.Pixel(x, y, color))));
    }
}
