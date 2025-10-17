package space.pxls.server;

import com.google.gson.JsonObject;
import io.undertow.Handlers;
import io.undertow.Undertow;
import io.undertow.server.HttpHandler;
import io.undertow.server.handlers.AllowedMethodsHandler;
import io.undertow.server.handlers.DisableCacheHandler;
import io.undertow.server.handlers.form.EagerFormParsingHandler;
import io.undertow.server.handlers.resource.ClassPathResourceManager;
import io.undertow.server.handlers.resource.FileResourceManager;
import io.undertow.util.Headers;
import io.undertow.util.Methods;
import io.undertow.websockets.core.AbstractReceiveListener;
import io.undertow.websockets.core.BufferedTextMessage;
import io.undertow.websockets.core.WebSocketChannel;
import io.undertow.websockets.core.WebSockets;
import io.undertow.websockets.spi.WebSocketHttpExchange;
import io.undertow.server.session.*;

import org.pac4j.undertow.handler.CallbackHandler;
import org.pac4j.undertow.handler.LogoutHandler;
import org.pac4j.undertow.handler.SecurityHandler;
import org.pac4j.core.authorization.authorizer.DefaultAuthorizers;
import org.pac4j.core.config.Config;
import org.pac4j.oidc.client.OidcClient;

import space.pxls.App;
import space.pxls.auth.OpenIDConfig;
import space.pxls.server.packets.chat.*;
import space.pxls.server.packets.socket.*;
import space.pxls.tasks.UserAuthedTask;
import space.pxls.user.User;
import space.pxls.util.*;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.function.Predicate;

public class UndertowServer {
    private int port;
    private PacketHandler socketHandler;
    private WebHandler webHandler;
    private ConcurrentHashMap<Integer, User> authedUsers = new ConcurrentHashMap<Integer, User>();

    private Set<PxlsWebSocketConnection> connections;
    private Undertow server;

    private ExecutorService userTaskExecutor = Executors.newFixedThreadPool(4);

    public UndertowServer(int port) {
        this.port = port;

        webHandler = new WebHandler();
        socketHandler = new PacketHandler(this);
        connections = ConcurrentHashMap.newKeySet();
    }

    public void start() {
        final Config config = new OpenIDConfig().build();
        
        var pathHandler = new PxlsPathHandler()
                .addPermGatedExactPath("/ws", "board.socket", Handlers.websocket(this::webSocketHandler))
                .addPermGatedPrefixPath("/ws", "board.socket", Handlers.websocket(this::webSocketHandler))
                .addPermGatedPrefixPath("/info", "board.info", new DisableCacheHandler(webHandler::info))
                .addPermGatedPrefixPath("/boarddata", "board.data", new DisableCacheHandler(webHandler::data))
                .addPermGatedPrefixPath("/heatmap", "board.data", new DisableCacheHandler(webHandler::heatmap))
                .addPermGatedPrefixPath("/virginmap", "board.data", new DisableCacheHandler(webHandler::virginmap))
                .addPermGatedPrefixPath("/placemap", "board.data", new DisableCacheHandler(webHandler::placemap))
                .addPermGatedPrefixPath("/initialboarddata", "board.data", webHandler::initialdata)
                // NOTE ([  ]): This endpoint was /auth which was a perfectly fine
                // endpoint in my eyes. Apparently, The gods think differently.
                // Don't use /auth — it's absolutely cursed. One callback will
                // go through, and then you'll not be able to check session state
                // from that endpoint again for an indeterminate time (yes even
                // across restarts).
                // This could be some obscure bug caused by pac4j or some other 
                // quirk in pxls code, so it might go away at some point, but I've
                // lost a day in debugging this and I still feel like I'm not much
                // closer to working out what the hell is going on — I've only
                // found out how much more impossible of a bug it seems.
                .addPermGatedPrefixPath("/callback", "user.auth", new RateLimitingHandler(CallbackHandler.build(config), "http:auth", (int) App.getConfig().getDuration("server.limits.auth.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.auth.count")))
                .addPermGatedPrefixPath("/signin", "user.auth", webHandler.signInHandler(config))
                .addPermGatedPrefixPath("/logout", "user.auth", new LogoutHandler(config))
                .addPermGatedPrefixPath("/lookup", "board.lookup", new RateLimitingHandler(webHandler::lookup, "http:lookup", (int) App.getConfig().getDuration("server.limits.lookup.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.lookup.count")))
                .addPermGatedPrefixPath("/report", "board.report", webHandler::report)
                .addPermGatedPrefixPath("/reportChat", "chat.report", webHandler::chatReport)
                .addPermGatedPrefixPath("/whoami", "user.auth", webHandler::whoami)
                .addPermGatedPrefixPath("/users", "user.online", webHandler::users)
                .addPermGatedPrefixPath("/chat/history", "chat.history", new RateLimitingHandler(new DisableCacheHandler(webHandler::chatHistory), "http:chatHistory", (int) App.getConfig().getDuration("server.limits.chatHistory.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.chatHistory.count")))
                .addPermGatedPrefixPath("/chat/setColor", "user.chatColorChange", new RateLimitingHandler(webHandler::chatColorChange, "http:chatColorChange", (int) App.getConfig().getDuration("server.limits.chatColorChange.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.chatColorChange.count")))
                .addPermGatedPrefixPath("/admin", "user.admin", Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/admin/")).setCacheTime(10))
                .addPermGatedPrefixPath("/admin/ban", "user.ban", webHandler::ban)
                .addPermGatedPrefixPath("/admin/unban", "user.unban", webHandler::unban)
                .addPermGatedPrefixPath("/admin/permaban", "user.permaban", webHandler::permaban)
                .addPermGatedPrefixPath("/admin/shadowban", "user.shadowban", webHandler::shadowban)
                .addPermGatedPrefixPath("/admin/chatban", "chat.ban", webHandler::chatban)
                .addPermGatedPrefixPath("/admin/check", "board.check", webHandler::check)
                .addPermGatedPrefixPath("/admin/delete", "chat.delete", webHandler::deleteChatMessage)
                .addPermGatedPrefixPath("/admin/chatPurge", "chat.purge", webHandler::chatPurge)
                .addPermGatedPrefixPath("/admin/faction/edit", "faction.edit.other", new JsonReader(webHandler::adminEditFaction))
                .addPermGatedPrefixPath("/admin/faction/delete", "faction.delete.other", new JsonReader(webHandler::adminDeleteFaction))
                .addPermGatedPrefixPath("/admin/setFactionBlocked", "faction.setblocked", new AllowedMethodsHandler(webHandler::setFactionBlocked, Methods.POST))
                .addPermGatedPrefixPath("/createNotification", "notification.create", webHandler::createNotification)
                .addPermGatedPrefixPath("/sendNotificationToDiscord", "notification.discord", webHandler::sendNotificationToDiscord)
                .addPermGatedPrefixPath("/setNotificationExpired", "notification.expired", webHandler::setNotificationExpired)
                .addPermGatedPrefixPath("/notifications", "notification.list", webHandler::notificationsList)
                .addPermGatedPrefixPath("/console", "management.console", new AllowedMethodsHandler(webHandler::webConsole, Methods.POST))
                .addPermGatedPrefixPath("/api/v1/profile", "user.profile", new AllowedMethodsHandler(webHandler::profile, Methods.GET))
                .addExactPath("/factions", new AllowedMethodsHandler(webHandler::getRequestingUserFactions, Methods.GET));
        if (new File(App.getStorageDir().resolve("emoji").toString()).exists()) {
            pathHandler.addPrefixPath("/emoji", Handlers.resource(new FileResourceManager(new File(App.getStorageDir().resolve("emoji").toString()))).setCacheTime(604800));
        }
        PxlsRoutingHandler routingHandler = PxlsHandlers.routing()
            .getPermGated("/factions/{fid}", "faction.data", new JsonReader(new RateLimitingHandler(webHandler::manageFactions, "http:manageFactions", (int) App.getConfig().getDuration("server.limits.manageFactions.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.manageFactions.count"), App.getConfig().getBoolean("server.limits.manageFactions.global"))))
            .postPermGated("/factions", "faction.create", new JsonReader(new RateLimitingHandler(webHandler::manageFactions, "http:manageFactions", (int) App.getConfig().getDuration("server.limits.manageFactions.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.manageFactions.count"), App.getConfig().getBoolean("server.limits.manageFactions.global"))))
            .putPermGated("/factions/{fid}", "faction.edit", new JsonReader(new RateLimitingHandler(webHandler::manageFactions, "http:manageFactions", (int) App.getConfig().getDuration("server.limits.manageFactions.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.manageFactions.count"), App.getConfig().getBoolean("server.limits.manageFactions.global"))))
            .deletePermGated("/factions/{fid}", "faction.delete", new JsonReader(new RateLimitingHandler(webHandler::manageFactions, "http:manageFactions", (int) App.getConfig().getDuration("server.limits.manageFactions.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.manageFactions.count"), App.getConfig().getBoolean("server.limits.manageFactions.global"))))
            .setFallbackHandler(pathHandler);
        //EncodingHandler encoder = new EncodingHandler(mainHandler, new ContentEncodingRepository().addEncodingHandler("gzip", new GzipEncodingProvider(), 50, Predicates.parse("max-content-size(1024)")));

        HttpHandler defaultHandler = SecurityHandler.build(
            new IPReader(new AuthReader(new EagerFormParsingHandler().setNext(routingHandler))),
            config,
            // FIXME ([  ]): I'm not sure how the ordering of this works, but I
            // presume it's start to end. I mention this because ideally
            // HeaderClient should be more important than OidcClient, but 
            // OidcClient no longer works when HeaderClient comes first.
            "OidcClient,HeaderClient,IpClient,AnonymousClient",
            // The default (null / "") includes a CSRF check for post requests
            // that pxls just doesn't have.
            DefaultAuthorizers.NONE
        );

        HttpHandler callbackHandler = new IPReader(new EagerFormParsingHandler().setNext(routingHandler));

        server = Undertow.builder()
                .addHttpListener(port, "0.0.0.0")
                .setIoThreads(32)
                .setWorkerThreads(128)
                .setHandler(new SessionAttachmentHandler(
                    exchange -> {
                        // FIXME ([  ]): I'll admit, this is a bit of a hack,
                        // but I really don't want to specify the authreader and
                        // security handlers for every endpoint individually
                        // *except* for the callback.
                        // (Fundamentally, I don't see a reason why the security
                        // handler couldn't work on the callback endpoint, but
                        // it has some parameter collision which results in
                        // endless self-redirects)
                        if (exchange.getRequestPath().startsWith("/callback")) {
                            callbackHandler.handleRequest(exchange);
                        } else {
                            defaultHandler.handleRequest(exchange);
                        }
                    },
                    new InMemorySessionManager("pxls"),
                    new SessionCookieConfig()
                ))
                .build();
        server.start();
    }

    private void webSocketHandler(WebSocketHttpExchange exchange, WebSocketChannel channel) {
        User user = exchange.getAttachment(AuthReader.USER);
        String ip = exchange.getAttachment(IPReader.IP);

        socketHandler.connect(channel, user);

        PxlsWebSocketConnection con = new PxlsWebSocketConnection(channel, user);
        connections.add(con);

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
            user.setUserAgent(agent);

            userTaskExecutor.submit(new UserAuthedTask(channel, user, ip)); //ip at this point should have gone through all the checks to extract an actual IP from behind a reverse proxy
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
                if (type.equals("admin_placement_overrides")) obj = App.getGson().fromJson(jsonObj, ClientAdminPlacementOverrides.class);
                if (type.equals("admin_message")) obj = App.getGson().fromJson(jsonObj, ClientAdminMessage.class);
                if (type.equals("shadowbanme")) obj = App.getGson().fromJson(jsonObj, ClientShadowBanMe.class);
                if (type.equals("banme")) obj = App.getGson().fromJson(jsonObj, ClientBanMe.class);
                if (type.equalsIgnoreCase("ChatHistory")) obj = App.getGson().fromJson(jsonObj, ClientChatHistory.class);
                if (type.equalsIgnoreCase("ChatbanState")) obj = App.getGson().fromJson(jsonObj, ClientChatbanState.class);
                if (type.equalsIgnoreCase("ChatMessage")) obj = App.getGson().fromJson(jsonObj, ClientChatMessage.class);
                if (type.equalsIgnoreCase("ChatLookup")) obj = App.getGson().fromJson(jsonObj, ClientChatLookup.class);

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
            connections.remove(con);

            if (user != null) {
                user.getConnections().remove(channel);
            }

            socketHandler.disconnect(channel, user);
        });
        channel.resumeReceives();
    }

    public Set<PxlsWebSocketConnection> getConnections() {
        return connections;
    }

    public void broadcast(Object obj) {
        String json = App.getGson().toJson(obj);
        if (connections != null) {
            for (PxlsWebSocketConnection channel : connections) {
                sendRaw(channel, json);
            }
        }
    }

    public void broadcastRaw(String raw) {
        if (connections != null) {
            connections.forEach(channel -> sendRaw(channel, raw));
        }
    }

    public void broadcastNoShadow(Object obj) {
        broadcastToUserPredicate(obj, user -> !user.isShadowBanned());
    }

    private Predicate<User> userCanReceiveStaffBroadcasts = user -> user.hasPermission("user.receivestaffbroadcasts");

    public void broadcastToStaff(Object obj) {
        broadcastToUserPredicate(obj, userCanReceiveStaffBroadcasts);
    }

    public void broadcastToUserPredicate(Object obj, Predicate<User> predicate) {
        String json = App.getGson().toJson(obj);
        getAuthedUsers()
                .values()
                .stream()
                .filter(predicate)
                .forEach(user -> user.getConnections()
                        .forEach(con -> WebSockets.sendText(json, con, null))
                );
    }

    public void broadcastPredicate(Object obj, Predicate<PxlsWebSocketConnection> predicate) {
        String json = App.getGson().toJson(obj);
        connections.parallelStream()
                .filter(predicate)
                .forEach(con -> WebSockets.sendText(json, con.getChannel(), null));
    }

    public void broadcastSeparateForStaff(Object nonStaffObj, Object staffObj) {
        broadcastPredicateSeparateForStaff(nonStaffObj, staffObj, con -> true);
    }

    public void broadcastPredicateSeparateForStaff(Object nonStaffObj, Object staffObj, Predicate<PxlsWebSocketConnection> predicate) {
        String nonStaffJSON = nonStaffObj != null ? App.getGson().toJson(nonStaffObj) : null;
        String staffJSON = staffObj != null ? App.getGson().toJson(staffObj) : null;
        broadcastMapped(con -> {
            if (predicate.test(con)) {
                boolean sendStaffObject = con.getUser().isPresent() && userCanReceiveStaffBroadcasts.test(con.getUser().get());
                return sendStaffObject ? staffJSON : nonStaffJSON;
            } else {
                return null;
            }
        });
    }

    public void broadcastMapped(Function<PxlsWebSocketConnection, String> mapper) {
        connections.parallelStream()
                .forEach(con -> {
                    String json = mapper.apply(con);
                    if (json != null) {
                        WebSockets.sendText(json, con.getChannel(), null);
                    }
                });
    }

    public void send(WebSocketChannel channel, Object obj) {
        sendRaw(channel, App.getGson().toJson(obj));
    }

    public void send(User user, Object obj) {
        sendRaw(user, App.getGson().toJson(obj));
    }

    public void sendRaw(User user, String raw) {
        user.getConnections().forEach(channel -> sendRaw(channel, raw));
    }

    private void sendRaw(PxlsWebSocketConnection channel, String str) {
        WebSockets.sendText(str, channel.getChannel(), null);
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

    public int getNonIdledUsersCount() {
        int nonIdles = 0;
        for (User value : App.getServer().getAuthedUsers().values()) {
            if (!value.isIdled()) ++nonIdles;
        }
        return nonIdles;
    }

    public Undertow getServer() {
        return server;
    }

    public WebHandler getWebHandler() {
        return webHandler;
    }
}
