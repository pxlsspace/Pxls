package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.util.AttachmentKey;
import space.pxls.App;
import space.pxls.user.User;
import space.pxls.user.UserLogin;

import java.util.concurrent.ConcurrentHashMap;

public class AuthReader implements HttpHandler {
    public static AttachmentKey<User> USER = AttachmentKey.create(User.class);

    private static ConcurrentHashMap<String, String> loginCache = new ConcurrentHashMap<>();

    private HttpHandler next;

    public AuthReader(HttpHandler next) {
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        if (!App.getConfig().getBoolean("oauth.useIp")) {
            Cookie header = exchange.getRequestCookie("pxls-token");
            if (header != null) {
                User user = App.getUserManager().getByToken(header.getValue());
                if (user != null) {
                    exchange.putAttachment(USER, user);
                }
            }
        } else {
            String ip = exchange.getAttachment(IPReader.IP);

            final User[] user = new User[1];
            if (loginCache.containsKey(ip)) {
                user[0] = App.getUserManager().getByToken(loginCache.get(ip));
            } else {
                loginCache.compute(ip, (key, old) -> {
                    user[0] = App.getUserManager().getSnipByIP(ip);

                    if (user[0] == null) {
                        String signupToken = App.getUserManager().generateUserCreationToken(new UserLogin("ip", ip));
                        user[0] = App.getUserManager().signUp(MD5.compute(ip), signupToken, ip);
                    }

                    return App.getUserManager().logIn(user[0], ip);
                });
            }
            exchange.putAttachment(USER, user[0]);
        }

        next.handleRequest(exchange);
    }
}
