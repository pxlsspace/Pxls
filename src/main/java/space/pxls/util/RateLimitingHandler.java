package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.RedirectHandler;
import io.undertow.server.handlers.ResponseCodeHandler;
import io.undertow.util.StatusCodes;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimitingHandler implements HttpHandler {
    private HttpHandler next;
    private Map<String, RequestBucket> buckets = new ConcurrentHashMap<>();
    private int time;
    private int count;

    public RateLimitingHandler(HttpHandler next, int time, int count) {
        this.next = next;
        this.time = time;
        this.count = count;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        String ip = exchange.getAttachment(IPReader.IP);
        System.out.println(ip);

        RequestBucket bucket = buckets.<String, RequestBucket>compute(ip, (key, old) -> {
            if (old == null) return new RequestBucket(System.currentTimeMillis(), 0);
            if (old.startTime + time * 1000 < System.currentTimeMillis())
                return new RequestBucket(System.currentTimeMillis(), 0);
            return old;
        });
        bucket.count++;
        if (bucket.count > count)
        {
            new ResponseCodeHandler(StatusCodes.TOO_MANY_REQUESTS).handleRequest(exchange);
        } else {
            next.handleRequest(exchange);
        }
    }

    public static class RequestBucket {
        public long startTime;
        public int count;

        public RequestBucket(long startTime, int count) {
            this.startTime = startTime;
            this.count = count;
        }
    }
}
