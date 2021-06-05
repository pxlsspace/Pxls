package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.RoutingHandler;

public class PxlsRoutingHandler extends RoutingHandler {
    public synchronized PxlsRoutingHandler getPermGated(final String template, String node, HttpHandler handler) {
        return (PxlsRoutingHandler) super.get(template, new HttpPermissionGate(node, handler));
    }

    public synchronized PxlsRoutingHandler postPermGated(final String template, String node, HttpHandler handler) {
        return (PxlsRoutingHandler) super.post(template, new HttpPermissionGate(node, handler));
    }

    public synchronized PxlsRoutingHandler putPermGated(final String template, String node, HttpHandler handler) {
        return (PxlsRoutingHandler) super.put(template, new HttpPermissionGate(node, handler));
    }

    public synchronized PxlsRoutingHandler deletePermGated(final String template, String node, HttpHandler handler) {
        return (PxlsRoutingHandler) super.delete(template, new HttpPermissionGate(node, handler));
    }

    @Override
    public PxlsRoutingHandler setFallbackHandler(HttpHandler fallbackHandler) {
        super.setFallbackHandler(fallbackHandler);
        return this;
    }
}
