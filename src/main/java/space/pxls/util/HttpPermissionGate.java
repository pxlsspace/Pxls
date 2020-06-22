package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.user.Permission;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class HttpPermissionGate implements HttpHandler {
    Permission permission;
    HttpHandler next;

    public HttpPermissionGate(String node, HttpHandler next) {
        this.permission = App.getPermissionManager().resolve(node);
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        User user = exchange.getAttachment(AuthReader.USER);
        List<Role> roles = App.getRoleManager().getDefaultRoles();
        if (user != null) {
            roles = user.getRoles();
        }
        // Sanity check--if the user has no roles, assume default again.
        if (roles.isEmpty()) roles = App.getRoleManager().getDefaultRoles();
        if (roles.stream().anyMatch(role -> role.hasPermission(this.permission))) {
            next.handleRequest(exchange);
            return;
        }
        exchange.setStatusCode(StatusCodes.FORBIDDEN);
        exchange.endExchange();
    }
}
