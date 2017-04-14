package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.util.AttachmentKey;
import space.pxls.App;
import space.pxls.user.User;

public class AuthReader implements HttpHandler {
    public static AttachmentKey<User> USER = AttachmentKey.create(User.class);
    private HttpHandler next;

    public AuthReader(HttpHandler next) {
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        Cookie header = exchange.getRequestCookies().get("pxls-token");
        if (header != null) {
            User user = App.getUserManager().getByToken(header.getValue());
            if (user != null) {
                exchange.putAttachment(USER, user);
            }
        }
        next.handleRequest(exchange);
    }
}
