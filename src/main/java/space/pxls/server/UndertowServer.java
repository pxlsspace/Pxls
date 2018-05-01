package space.pxls.server;

import com.google.gson.JsonObject;
import io.undertow.Handlers;
import io.undertow.Undertow;
import io.undertow.server.handlers.PathHandler;
import io.undertow.server.handlers.form.EagerFormParsingHandler;
import io.undertow.server.handlers.resource.ClassPathResourceManager;
import io.undertow.util.Headers;
import io.undertow.util.HttpString;
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
import space.pxls.user.UserManager;
import space.pxls.user.User;
import space.pxls.user.Role;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public class UndertowServer {
    private int port;
    private PacketHandler socketHandler;
    private WebHandler webHandler;
    private ConcurrentHashMap<Integer, User> authedUsers = new ConcurrentHashMap<Integer, User>();

    private Set<WebSocketChannel> connections;
    private Undertow server;

    public UndertowServer(int port) {
        this.port = port;

        webHandler = new WebHandler();
        socketHandler = new PacketHandler(this);
    }

    public void start() {
        PathHandler mainHandler = Handlers.path()
                .addExactPath("/ws", Handlers.websocket(this::webSocketHandler))
                .addPrefixPath("/ws", Handlers.websocket(this::webSocketHandler))
                .addPrefixPath("/info", webHandler::info)
                .addPrefixPath("/boarddata", webHandler::data)
                .addPrefixPath("/heatmap", webHandler::heatmap)
                .addPrefixPath("/logout", webHandler::logout)
                .addPrefixPath("/lookup", new RateLimitingHandler(webHandler::lookup, (int) App.getConfig().getDuration("server.limits.lookup.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.lookup.count")))
                .addPrefixPath("/report", webHandler::report)
                .addPrefixPath("/signin", webHandler::signIn)
                .addPrefixPath("/users", webHandler::users)
                .addPrefixPath("/auth", new RateLimitingHandler(webHandler::auth, (int) App.getConfig().getDuration("server.limits.auth.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.auth.count")))
                .addPrefixPath("/signup", new RateLimitingHandler(webHandler::signUp, (int) App.getConfig().getDuration("server.limits.signup.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.signup.count")))
                .addPrefixPath("/admin/ban", new RoleGate(Role.MODERATOR, webHandler::ban))
                .addPrefixPath("/admin/unban", new RoleGate(Role.MODERATOR, webHandler::unban))
                .addPrefixPath("/admin/permaban", new RoleGate(Role.MODERATOR, webHandler::permaban))
                .addPrefixPath("/admin/shadowban", new RoleGate(Role.ADMIN, webHandler::shadowban))
                .addPrefixPath("/admin/check", new RoleGate(Role.MODERATOR, webHandler::check))
                .addPrefixPath("/admin", new RoleGate(Role.MODERATOR, Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/admin/"))
                        .setCacheTime(10)))
                .addExactPath("/", webHandler::index)
                .addExactPath("/index.html", webHandler::index)
                .addPrefixPath("/", Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/"))
                        .setCacheTime(10));
        //EncodingHandler encoder = new EncodingHandler(mainHandler, new ContentEncodingRepository().addEncodingHandler("gzip", new GzipEncodingProvider(), 50, Predicates.parse("max-content-size(1024)")));
        server = Undertow.builder()
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
            
            // aaaaaaand update the useragent
            List<String> agentAr = exchange.getRequestHeaders().get(Headers.USER_AGENT.toString());
            String agent = "";
            if (agentAr != null) {
                agent = agentAr.get(0);
            }
            if (agent == null) {
                agent = "";
            }
            user.setUseragent(agent);
        }

        channel.getReceiveSetter().set(new AbstractReceiveListener() {
            @Override
            protected void onFullTextMessage(WebSocketChannel channel, BufferedTextMessage message) throws IOException {
                super.onFullTextMessage(channel, message);

                String data = message.getData();

                JsonObject jsonObj = App.getGson().fromJson(data, JsonObject.class);
                String type = jsonObj.get("type").getAsString();

                Object obj = null;
                if (type.equals("pixel")) obj = App.getGson().fromJson(jsonObj, ClientPlace.class);
                if (type.equals("undo")) obj = App.getGson().fromJson(jsonObj, ClientUndo.class);
                if (type.equals("captcha")) obj = App.getGson().fromJson(jsonObj, ClientCaptcha.class);
                if (type.equals("admin_cdoverride"))
                    obj = App.getGson().fromJson(jsonObj, ClientAdminCooldownOverride.class);
                if (type.equals("admin_message"))
                    obj = App.getGson().fromJson(jsonObj, ClientAdminMessage.class);
                if (type.equals("shadowbanme")) obj = App.getGson().fromJson(jsonObj, ClientShadowBanMe.class);
                if (type.equals("banme")) obj = App.getGson().fromJson(jsonObj, ClientBanMe.class);
                
                
                // old thing, will auto-shadowban
                if (type.equals("place")) obj = App.getGson().fromJson(jsonObj, ClientPlace.class);
                
                // lol
                if (type.equals("placepixel")) obj = App.getGson().fromJson(jsonObj, ClientBanMe.class);

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

    public void broadcastNoShadow(Object obj) {
        String json = App.getGson().toJson(obj);
        Map<String, User> users = App.getUserManager().getAllUsersByToken();
        List<WebSocketChannel> shadowbannedConnection = new ArrayList<>();
        for (User u : users.values()) {
            if (u.getRole() == Role.SHADOWBANNED) {
                shadowbannedConnection.addAll(u.getConnections());
            }
        }
        for (WebSocketChannel channel : connections){
            if (!shadowbannedConnection.contains(channel)){
                sendRaw(channel, json);
            }
        }
    }

    private void sendRaw(WebSocketChannel channel, String str) {
        WebSockets.sendText(str, channel, null);
    }

    public PacketHandler getPacketHandler() {
        return socketHandler;
    }

    public void addAuthedUser(User user) {
        if (!authedUsers.containsKey(user.getId()) && !user.isBanned() && !user.isShadowBanned()) {
            authedUsers.put(user.getId(), user);
        }
    }

    public void removeAuthedUser(User user) {
        authedUsers.remove(user.getId());
    }

    public ConcurrentHashMap<Integer, User> getAuthedUsers() {
        return this.authedUsers;
    }

    public Undertow getServer() {
        return server;
    }
}
