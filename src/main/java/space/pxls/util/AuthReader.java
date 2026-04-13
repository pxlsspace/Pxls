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
                            // TODO ([  ]): check if this needs to be updated.
                            // Otherwise this is run for every request, which
                            // is expensive. Users should probably also be cached
                            // for similar reasons.
                            final Object maybe_accounts = profile.getAttribute("accounts");
                            if (maybe_accounts instanceof JSONArray) {
                                final JSONArray accounts = (JSONArray) maybe_accounts;

                                final List<Provider> links = accounts.stream()
                                    .map(o -> {
                                        Optional<Provider> provider;
                                        if (o instanceof JSONObject) {
                                            provider = Provider.fromJSON((JSONObject) o);
                                        } else {
                                            provider = Optional.empty();
                                        }
                                        return provider;
                                    })
                                    .filter(Optional::isPresent)
                                    .map(Optional::get)
                                    .collect(Collectors.toList());
                                    
                                user.setLinks(links);
                            }
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
