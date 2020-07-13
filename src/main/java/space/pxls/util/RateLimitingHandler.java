package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;

public class RateLimitingHandler implements HttpHandler {
    private HttpHandler next;
    private String bucketType;

    public RateLimitingHandler(HttpHandler next, Class bucketType, int time, int count) {
        this(next, bucketType.getSimpleName(), time, count);
    }
    public RateLimitingHandler(HttpHandler next, String bucketType, int time, int count) {
        this.bucketType = bucketType;
        this.next = next;
        RateLimitFactory.registerBucketHolder(bucketType, new RateLimitFactory.BucketConfig(time, count));
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        String ip = exchange.getAttachment(IPReader.IP);
        Cookie header = exchange.getRequestCookies().get("pxls-token");
        if (header != null) {
            User user = App.getUserManager().getByToken(header.getValue());
            if (user != null && user.hasPermission("user.ratelimits.bypass")) {
                next.handleRequest(exchange);
                return;
            }
        }

        int seconds = RateLimitFactory.getTimeRemaining(bucketType, ip);
        if (seconds > 0) {
            exchange.setStatusCode(StatusCodes.TOO_MANY_REQUESTS);
            exchange.getResponseSender().send(String.format("You're doing that too much. Try again in %d seconds.", seconds));
        } else {
            next.handleRequest(exchange);
        }
    }
}
