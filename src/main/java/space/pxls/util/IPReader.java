package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.AttachmentKey;
import io.undertow.util.HeaderValues;
import space.pxls.App;

public class IPReader implements HttpHandler {
    public static AttachmentKey<String> IP = AttachmentKey.create(String.class);

    private HttpHandler next;

    public IPReader(HttpHandler next) {
        this.next = next;
    }


    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        String addr = exchange.getSourceAddress().getAddress().getHostAddress();

        if (addr.equals("127.0.0.1") || addr.equals("0:0:0:0:0:0:0:1")) {
            HeaderValues header = exchange.getRequestHeaders().get(App.getConfig().getString("server.proxyHeaderIPField"));
            if (header != null && !header.isEmpty()) {
                addr = header.element();
            }
        }

        exchange.putAttachment(IP, addr);
        next.handleRequest(exchange);
    }
}
