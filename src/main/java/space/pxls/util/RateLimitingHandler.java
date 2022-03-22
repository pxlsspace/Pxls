package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.user.User;

public class RateLimitingHandler implements HttpHandler {
    private HttpHandler next;
    private String bucketType;
    // FIXME: global is used as a hack - rate-limit applies to ALL USERS
    private boolean global;

    public RateLimitingHandler(HttpHandler next, Class bucketType, int time, int count) {
        this(next, bucketType.getSimpleName(), time, count);
    }
    public RateLimitingHandler(HttpHandler next, String bucketType, int time, int count) {
        this.bucketType = bucketType;
        this.next = next;
        RateLimitFactory.registerBucketHolder(bucketType, new RateLimitFactory.BucketConfig(time, count));
    }
    public RateLimitingHandler(HttpHandler next, String bucketType, int time, int count, boolean global) {
        this.bucketType = bucketType;
        this.next = next;
        this.global = global;
        RateLimitFactory.registerBucketHolder(bucketType, new RateLimitFactory.BucketConfig(time, count, global));
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        // FIXME: is there anything wrong with using 0.0.0.0?
        String ip = "0.0.0.0";
        if (!global) ip = exchange.getAttachment(IPReader.IP);
        Cookie header = exchange.getRequestCookie("pxls-token");
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
            if (global) {
                exchange.getResponseSender().send(String.format("Too many people are doing that. Try again in %d seconds.", seconds));
            } else {
                exchange.getResponseSender().send(String.format("You're doing that too much. Try again in %d seconds.", seconds));
            }
        } else {
            next.handleRequest(exchange);
        }
    }
}
