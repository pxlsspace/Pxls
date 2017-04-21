package space.pxls.server;

import com.google.gson.JsonObject;
import io.undertow.Handlers;
import io.undertow.Undertow;
import io.undertow.server.handlers.PathHandler;
import io.undertow.server.handlers.form.EagerFormParsingHandler;
import io.undertow.server.handlers.resource.ClassPathResourceManager;
import io.undertow.websockets.core.AbstractReceiveListener;
import io.undertow.websockets.core.BufferedTextMessage;
import io.undertow.websockets.core.WebSocketChannel;
import io.undertow.websockets.core.WebSockets;
import io.undertow.websockets.spi.WebSocketHttpExchange;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.AuthReader;
import space.pxls.util.IPReader;
import space.pxls.util.RateLimitingHandler;
import space.pxls.util.RoleGate;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class UndertowServer {
    private int port;
    private PacketHandler socketHandler;
    private WebHandler webHandler;

    private Set<WebSocketChannel> connections;

    public UndertowServer(int port) {
        this.port = port;

        webHandler = new WebHandler();
        socketHandler = new PacketHandler(this);
    }

    public void start() {
        PathHandler mainHandler = Handlers.path()
                .addPrefixPath("/ws", Handlers.websocket(this::webSocketHandler))
                .addPrefixPath("/info", webHandler::info)
                .addPrefixPath("/boarddata", webHandler::data)
                .addPrefixPath("/logout", webHandler::logout)
                .addPrefixPath("/lookup", webHandler::lookup)
                .addPrefixPath("/signin", webHandler::signIn)
                .addPrefixPath("/auth", new RateLimitingHandler(webHandler::auth, (int) App.getConfig().getDuration("server.limits.auth.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.auth.count")))
                .addPrefixPath("/signup/do", new RateLimitingHandler(webHandler::signUp, (int) App.getConfig().getDuration("server.limits.signup.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.signup.count")))
                .addPrefixPath("/admin/ban", new RoleGate(Role.ADMIN, webHandler::ban))
                .addPrefixPath("/admin/unban", new RoleGate(Role.ADMIN, webHandler::unban))
                .addPrefixPath("/admin/check", new RoleGate(Role.MODERATOR, webHandler::check))
                .addPrefixPath("/admin", new RoleGate(Role.MODERATOR, Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/admin/"))
                        .setCacheTime(10)))
                .addPrefixPath("/", Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/"))
                        .setCacheTime(10));
        //EncodingHandler encoder = new EncodingHandler(mainHandler, new ContentEncodingRepository().addEncodingHandler("gzip", new GzipEncodingProvider(), 50, Predicates.parse("max-content-size(1024)")));
        Undertow server = Undertow.builder()
                .addHttpListener(port, "0.0.0.0")
                .setIoThreads(32)
                .setWorkerThreads(128)
                .setHandler(new IPReader(new AuthReader(new EagerFormParsingHandler().setNext(mainHandler)))).build();
        server.start();
    }

    private void webSocketHandler(WebSocketHttpExchange exchange, WebSocketChannel channel) {
        connections = exchange.getPeerConnections();

        User user = exchange.getAttachment(AuthReader.USER);
        String ip = exchange.getAttachment(IPReader.IP);

        socketHandler.connect(channel, user);

        if (user != null) {
            user.getConnections().add(channel);
        }

        channel.getReceiveSetter().set(new AbstractReceiveListener() {
            @Override
            protected void onFullTextMessage(WebSocketChannel channel, BufferedTextMessage message) throws IOException {
                super.onFullTextMessage(channel, message);

                String data = message.getData();

                JsonObject jsonObj = App.getGson().fromJson(data, JsonObject.class);
                String type = jsonObj.get("type").getAsString();

                Object obj = null;
                if (type.equals("place")) obj = App.getGson().fromJson(jsonObj, Packet.ClientPlace.class);
                if (type.equals("captcha")) obj = App.getGson().fromJson(jsonObj, Packet.ClientCaptcha.class);
                if (type.equals("admin_cdoverride"))
                    obj = App.getGson().fromJson(jsonObj, Packet.ClientAdminCooldownOverride.class);
                if (type.equals("admin_message"))
                    obj = App.getGson().fromJson(jsonObj, Packet.ClientAdminMessage.class);
                if (type.equals("shadowbanme")) obj = App.getGson().fromJson(jsonObj, Packet.ClientShadowBanMe.class);
                if (type.equals("banme")) obj = App.getGson().fromJson(jsonObj, Packet.ClientBanMe.class);

                // lol
                if (type.equals("placepixel")) obj = App.getGson().fromJson(jsonObj, Packet.ClientBanMe.class);

                if (obj != null) {
                    socketHandler.accept(channel, user, obj, ip);
                }
            }
        });
        channel.getCloseSetter().set(c -> {
            if (user != null) {
                user.getConnections().remove(channel);
            }

            socketHandler.disconnect(channel, user);
        });
        channel.resumeReceives();
    }

    public void send(WebSocketChannel channel, Object obj) {
        sendRaw(channel, App.getGson().toJson(obj));
    }

    public Set<WebSocketChannel> getConnections() {
        return connections;
    }

    public void broadcast(Object obj) {
        String json = App.getGson().toJson(obj);
        for (WebSocketChannel channel : connections) {
            sendRaw(channel, json);
        }
    }

    private void sendRaw(WebSocketChannel channel, String str) {
        WebSockets.sendText(str, channel, null);
    }
}
