package space.pxls.util;

import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.RedirectHandler;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.util.Arrays;
import java.util.List;

public class RoleGate implements HttpHandler {
    private Role requiredRole;
    private HttpHandler next;

    public RoleGate(Role requiredRole, HttpHandler next) {
        this.requiredRole = requiredRole;
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        User user = exchange.getAttachment(AuthReader.USER);

        Role role = Role.GUEST;
        if (user != null) {
            role = user.getRole();
        }

        if (role.lessThan(this.requiredRole)) {
            // or, you know, an error page
            List<String> errors = Arrays.asList("https://www.youtube.com/watch?v=vTIIMJ9tUc8", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
            new RedirectHandler(errors.get((int) (Math.random() * errors.size()))).handleRequest(exchange);
        } else {
            next.handleRequest(exchange);
        }
    }
}
