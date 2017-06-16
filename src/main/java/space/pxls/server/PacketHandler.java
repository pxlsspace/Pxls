package space.pxls.server;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.async.Callback;
import com.mashape.unirest.http.exceptions.UnirestException;
import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.data.DBPixelPlacement;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.PxlsTimer;

import java.util.Collections;
import java.util.concurrent.TimeUnit;
import java.lang.Math;

public class PacketHandler {
    private UndertowServer server;
    private PxlsTimer userData = new PxlsTimer(5);

    private int getCooldown() {
        // TODO: make these parameters somehow configurable

        // exponential function of form a*exp(-b*(x - d)) + c
        double a = -8.04044740e+01;
        double b = 1.19078478e-03;
        double c = 9.63956320e+01;
        double d = -2.14065886e+00;
        double x = (double)server.getConnections().size();
        return (int)Math.ceil(a*Math.exp(-b*(x - d)) + c);
    }

    public PacketHandler(UndertowServer server) {
        this.server = server;
    }

    public void userdata(WebSocketChannel channel, User user) {
        if (user != null) {
            server.send(channel, new ServerUserInfo(
                    user.getName(),
                    user.getRole().name().equals("SHADOWBANNED") ? "USER" : user.getRole().name(),
                    user.isBanned(),
                    user.isBanned() ? user.getBanExpiryTime() : 0,
                    user.isBanned() ? user.getBanReason() : "",
                    user.getLogin().split(":")[0]
            ));
        }
    }

    public void connect(WebSocketChannel channel, User user) {
        if (user != null) {
            userdata(channel, user);
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
            if (obj instanceof ClientPlace) handlePlace(channel, user, ((ClientPlace) obj), ip);
            if (obj instanceof ClientUndo) handleUndo(channel, user, ((ClientUndo) obj));
            if (obj instanceof ClientCaptcha) handleCaptcha(channel, user, ((ClientCaptcha) obj));
            if (obj instanceof ClientShadowBanMe) handleShadowBanMe(channel, user, ((ClientShadowBanMe) obj));
            if (obj instanceof ClientBanMe) handleBanMe(channel, user, ((ClientBanMe) obj));

            if (user.getRole().greaterEqual(Role.MODERATOR)) {
                if (obj instanceof ClientAdminCooldownOverride)
                    handleCooldownOverride(channel, user, ((ClientAdminCooldownOverride) obj));

                if (obj instanceof ClientAdminMessage)
                    handleAdminMessage(channel, user, ((ClientAdminMessage) obj));
            }
        }
    }

    private void handleAdminMessage(WebSocketChannel channel, User user, ClientAdminMessage obj) {
        User u = App.getUserManager().getByName(obj.getUsername());
        if (u != null) {
            ServerAlert msg = new ServerAlert(obj.getMessage());
            for (WebSocketChannel ch : u.getConnections()) {
                server.send(ch, msg);
            }
        }
    }

    private void handleShadowBanMe(WebSocketChannel channel, User user, ClientShadowBanMe obj) {
        App.getDatabase().adminLog("self-shadowban via script", user.getId());
        user.shadowban("auto-ban via script");
    }

    private void handleBanMe(WebSocketChannel channel, User user, ClientBanMe obj) {
        App.getDatabase().adminLog("self-ban via script", user.getId());
        user.ban(86400, "auto-ban via script");
    }

    private void handleCooldownOverride(WebSocketChannel channel, User user, ClientAdminCooldownOverride obj) {
        user.setOverrideCooldown(obj.getOverride());
        sendCooldownData(user);
    }

    private void handleUndo(WebSocketChannel channel, User user, ClientUndo cu){
        if (!user.canUndoNow()) {
            return;
        }
        if (user.isShadowBanned()) {
            user.setLastUndoTime();
            user.setCooldown(0);
            sendCooldownData(user);
            return;
        }
        DBPixelPlacement thisPixel = App.getDatabase().getUserUndoPixel(user);
        DBPixelPlacement recentPixel = App.getDatabase().getPixelAt(thisPixel.x, thisPixel.y);
        if (thisPixel.id != recentPixel.id) return;
        
        user.setLastUndoTime();
        user.setCooldown(0);
        DBPixelPlacement lastPixel = App.getDatabase().getPixelByID(thisPixel.secondaryId);
        if (lastPixel != null) {
            App.getDatabase().putUserUndoPixel(lastPixel, user, thisPixel.id);
            App.putPixel(lastPixel.x, lastPixel.y, lastPixel.color, user, false, "(user undo)", false);
            broadcastPixelUpdate(lastPixel.x, lastPixel.y, lastPixel.color);
        } else {
            int defaultColor = App.getConfig().getInt("board.defaultColor");
            App.getDatabase().putUserUndoPixel(thisPixel.x, thisPixel.y, defaultColor, user, thisPixel.id);
            App.putPixel(thisPixel.x, thisPixel.y, defaultColor, user, false, "(user undo)", false);
            broadcastPixelUpdate(thisPixel.x, thisPixel.y, defaultColor);
        }
        sendCooldownData(user);
    }

    private void handlePlace(WebSocketChannel channel, User user, ClientPlace cp, String ip) {
        if (cp.getX() < 0 || cp.getX() >= App.getWidth() || cp.getY() < 0 || cp.getY() >= App.getHeight()) return;
        if (cp.getColor() < 0 || cp.getColor() >= App.getConfig().getStringList("board.palette").size()) return;
        if (user.isBanned()) return;

        if (user.canPlace()) {
            if (user.updateCaptchaFlagPrePlace() && App.isCaptchaEnabled()) {
                server.send(channel, new ServerCaptchaRequired());
            } else {
                if (App.getPixel(cp.getX(), cp.getY()) != cp.getColor()) {
                    int seconds = getCooldown();
                    if (App.getDatabase().didPixelChange(cp.getX(), cp.getY())) {
                        seconds = seconds * 2;
                    }
                    if (user.isShadowBanned()) {
                        // ok let's just pretend to set a pixel...
                        System.out.println("shadowban pixel!");
                        ServerPlace msg = new ServerPlace(Collections.singleton(new ServerPlace.Pixel(cp.getX(), cp.getY(), cp.getColor())));
                        for (WebSocketChannel ch : user.getConnections()) {
                            server.send(ch, msg);
                        }
                        if (user.canUndo()) {
                            server.send(channel, new ServerCanUndo(App.getConfig().getDuration("undo.window", TimeUnit.SECONDS)));
                        }
                    } else {
                        boolean mod_action = user.isOverridingCooldown();
                        App.putPixel(cp.getX(), cp.getY(), cp.getColor(), user, mod_action, ip, true);
                        App.saveMap();
                        broadcastPixelUpdate(cp.getX(), cp.getY(), cp.getColor());
                    }
                    if (!user.isOverridingCooldown()) {
                        user.setCooldown(seconds);
                        user.setLastPixelTime();
                        App.getDatabase().updateUserTime(user.getId(), seconds);
                        if (user.canUndo()) {
                            server.send(channel, new ServerCanUndo(App.getConfig().getDuration("undo.window", TimeUnit.SECONDS)));
                        }
                    }
                }
            }
        }

        sendCooldownData(user);
    }

    private void handleCaptcha(WebSocketChannel channel, User user, ClientCaptcha cc) {
        if (!user.isFlaggedForCaptcha()) return;
        if (user.isBanned()) return;

        Unirest
                .post("https://www.google.com/recaptcha/api/siteverify")
                .field("secret", App.getConfig().getString("captcha.secret"))
                .field("response", cc.getToken())
                //.field("remoteip", "null")
                .asJsonAsync(new Callback<JsonNode>() {
                    @Override
                    public void completed(HttpResponse<JsonNode> response) {
                        JsonNode body = response.getBody();

                        String hostname = App.getConfig().getString("host");

                        boolean success = body.getObject().getBoolean("success") && body.getObject().getString("hostname").equals(hostname);
                        if (success) {
                            user.validateCaptcha();
                        }

                        server.send(channel, new ServerCaptchaStatus(success));
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
            server.broadcast(new ServerUsers(server.getConnections().size()));
        });
    }

    private void sendCooldownData(WebSocketChannel channel, User user) {
        server.send(channel, new ServerCooldown(user.getRemainingCooldown()));
    }

    private void sendCooldownData(User user) {
        for (WebSocketChannel ch: user.getConnections()) {
            sendCooldownData(ch, user);
        }
    }

    private void broadcastPixelUpdate(int x, int y, int color) {
        server.broadcast(new ServerPlace(Collections.singleton(new ServerPlace.Pixel(x, y, color))));
    }
}
