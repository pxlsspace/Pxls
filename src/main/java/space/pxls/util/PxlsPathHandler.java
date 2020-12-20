package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.handlers.PathHandler;

public class PxlsPathHandler extends PathHandler {
    public synchronized PxlsPathHandler addPrefixPath(String path, HttpHandler handler) {
        return (PxlsPathHandler) super.addPrefixPath(path, handler);
    }

    public synchronized PxlsPathHandler addPermGatedPrefixPath(String path, String node, HttpHandler handler) {
        return (PxlsPathHandler) super.addPrefixPath(path, new HttpPermissionGate(node, handler));
    }

    public synchronized PxlsPathHandler addExactPath(String path, HttpHandler handler) {
        return (PxlsPathHandler) super.addExactPath(path, handler);
    }

    public synchronized PxlsPathHandler addPermGatedExactPath(String path, String node, HttpHandler handler) {
        return (PxlsPathHandler) super.addExactPath(path, new HttpPermissionGate(node, handler));
    }
}
