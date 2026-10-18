package space.pxls.util;

import io.undertow.security.api.SecurityContext;
import io.undertow.security.idm.Account;
import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.AttachmentKey;
import net.minidev.json.JSONArray;
import net.minidev.json.JSONObject;
import space.pxls.App;
import space.pxls.auth.Provider;
import space.pxls.user.User;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.pac4j.core.profile.UserProfile;
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
                for(UserProfile profile : ((Pac4jAccount) account).getProfiles()) {
                    User user = null;
                    if (profile instanceof OidcProfile) {
                        var oidcProfile = (OidcProfile) profile;
                        final String subject = (String) oidcProfile.getId();
                        if (subject != null) {
                            user = App.getUserManager().getByLogin(subject);
                            if (user == null) {
                                user = App.getUserManager().signUp(
                                    oidcProfile,
                                    exchange.getAttachment(IPReader.IP)
                                );
                            }
                            final Object maybe_accounts = profile.getAttribute("accounts");
                            if (maybe_accounts instanceof List) {
                                final List<?> accounts = (List) maybe_accounts;
                                final List<Provider> links = accounts.stream()
                                    .map(o -> (o instanceof Map)
                                        ? Provider.fromMap((Map) o)
                                        : Optional.<Provider>empty()
                                    )
                                    .flatMap(Optional::stream)
                                    .collect(Collectors.toList());
                                    
                                user.setLinks(links);
                            }
                            // NOTE ([  ]): remove the attribute. This
                            // essentially acts as a flag to signal that the
                            // data has been updated. Since it will only get
                            // populated the next time a change occurs, this
                            // avoids the overhead of redundantly updating every
                            // request.
                            profile.removeAttribute("accounts");
                        } else {
                            boolean devmode;
                            try {
                                devmode = App.getConfig().getBoolean("auth.devmode");
                            } catch(Exception e) {
                                devmode = false;
                            }
                            
                            if (devmode) {
                                System.err.println("Invalid authentication profile: " + oidcProfile);
                            }
                        }
                    } else if (profile instanceof IpProfile) {
                        user = App.getUserManager().getSnipByIP(profile.getId());
                        if (user == null) {
                            App.getUserManager().signUpByIp(
                                exchange.getAttachment(IPReader.IP)
                            );
                        }
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
