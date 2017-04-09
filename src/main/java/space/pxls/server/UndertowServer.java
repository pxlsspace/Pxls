package space.pxls.server;

import com.google.gson.JsonObject;
import io.undertow.Handlers;
import io.undertow.Undertow;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.server.handlers.resource.ClassPathResourceManager;
import io.undertow.util.Cookies;
import io.undertow.websockets.core.*;
import io.undertow.websockets.spi.AsyncWebSocketHttpServerExchange;
import io.undertow.websockets.spi.WebSocketHttpExchange;
import space.pxls.App;
import space.pxls.user.User;

import java.io.IOException;
import java.lang.reflect.Field;
import java.util.Set;

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
        Undertow server = Undertow.builder()
                .addHttpListener(port, "0.0.0.0")
                .setHandler(Handlers.path()
                        .addPrefixPath("/ws", Handlers.websocket(this::webSocketHandler))
                        .addPrefixPath("/info", webHandler::info)
                        .addPrefixPath("/boarddata", webHandler::data)
                        .addPrefixPath("/signin/", (x) -> webHandler.signIn(x))
                        .addPrefixPath("/auth/", (x) -> webHandler.auth(x))
                        .addPrefixPath("/signup/do", (x) -> webHandler.signUp(x))
                        .addPrefixPath("/", Handlers.resource(new ClassPathResourceManager(App.class.getClassLoader(), "public/"))
                        .setCacheTime(10))
                ).build();
        server.start();
    }

    private void webSocketHandler(WebSocketHttpExchange exchange, WebSocketChannel channel) {
        connections = exchange.getPeerConnections();

        String ip = channel.getSourceAddress().getAddress().getHostAddress();
        String ipf = exchange.getRequestHeader(App.getConfig().getString("server.proxyHeaderIPField"));
        if (ipf != null) {
            ip = ipf;
        }

        String token = "";
        try {
            Field field = exchange.getClass().getDeclaredField("exchange");
            field.setAccessible(true);
            HttpServerExchange xch = (HttpServerExchange) field.get(exchange);
            Cookie cookie = xch.getRequestCookies().get("pxls-token");

            if (cookie != null) {
                token = cookie.getValue();
            }
        } catch (NoSuchFieldException | IllegalAccessException e) {
            e.printStackTrace();
        }

        User user = App.getUserManager().getByToken(token);
        socketHandler.connect(channel, user);

        channel.getReceiveSetter().set(new AbstractReceiveListener() {
            @Override
            protected void onFullTextMessage(WebSocketChannel channel, BufferedTextMessage message) throws IOException {
                super.onFullTextMessage(channel, message);

                String data = message.getData();

                JsonObject jsonObj = App.getGson().fromJson(data, JsonObject.class);
                String type = jsonObj.get("type").getAsString();

                Object obj = null;
                if (type.equals("placepixel")) obj = App.getGson().fromJson(jsonObj, Packet.ClientPlace.class);
                if (type.equals("captcha")) obj = App.getGson().fromJson(jsonObj, Packet.ClientCaptcha.class);

                if (obj != null) {
                    socketHandler.accept(channel, user, obj);
                }
            }
        });
        channel.getCloseSetter().set(c -> socketHandler.disconnect(channel, user));
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

