package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class HttpPermissionGate implements HttpHandler {
    String permission;
    HttpHandler next;

    public HttpPermissionGate(String node, HttpHandler next) {
        this.permission = node;
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        User user = exchange.getAttachment(AuthReader.USER);
        List<Role> roles = Role.getGuestRoles();
        if (user != null) {
            roles = Stream.of(user.getRoles(), Role.getGuestRoles(), Role.getDefaultRoles())
                    .flatMap(Collection::stream)
                    .collect(Collectors.toList());
        }
        // Sanity check--if the user has no roles, assume guest again.
        if (roles.isEmpty()) roles = Role.getGuestRoles();
        if (roles.stream().anyMatch(role -> role.hasPermission(permission))) {
            next.handleRequest(exchange);
            return;
        }
        exchange.setStatusCode(StatusCodes.FORBIDDEN);
        exchange.endExchange();
    }
}
