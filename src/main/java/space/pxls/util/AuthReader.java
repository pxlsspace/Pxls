package space.pxls.util;

import io.undertow.security.api.SecurityContext;
import io.undertow.security.idm.Account;
import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.AttachmentKey;
import space.pxls.App;
import space.pxls.user.User;

import org.pac4j.core.profile.CommonProfile;
import org.pac4j.http.profile.IpProfile;
import org.pac4j.oidc.profile.OidcProfile;
import org.pac4j.undertow.account.Pac4jAccount;

public class AuthReader implements HttpHandler {
    public static AttachmentKey<User> USER = AttachmentKey.create(User.class);

    private HttpHandler next;

    public AuthReader(HttpHandler next) {
        this.next = next;
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        SecurityContext securityContext = exchange.getSecurityContext();
        if (securityContext != null) {
            Account account = securityContext.getAuthenticatedAccount();
            if (account instanceof Pac4jAccount) {
                for(CommonProfile profile : ((Pac4jAccount) account).getProfiles()) {
                    User user = null;

                    if (profile instanceof OidcProfile) {
                        // NOTE ([  ]): getSubject and getId work for indirect
                        // clients, but not for the Header direct client for some
                        // reason. May be a bug in pac4j.
                        final String subject = (String) ((OidcProfile) profile).getAttribute("sub");
                        user = App.getUserManager().getByLogin("oidc", subject);
                    } else if (profile instanceof IpProfile) {
                        user = App.getUserManager().getSnipByIP(profile.getId());
                    }
                    
                    if (user != null) {
                        exchange.putAttachment(USER, user);
                    }
                }
            }
        }

        next.handleRequest(exchange);
    }
}
