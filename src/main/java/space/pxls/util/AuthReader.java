package space.pxls.util;

import io.undertow.security.api.SecurityContext;
import io.undertow.security.idm.Account;
import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.util.AttachmentKey;
import io.undertow.websockets.core.WebSockets;
import net.minidev.json.JSONArray;
import net.minidev.json.JSONObject;
import space.pxls.App;
import space.pxls.auth.Provider;
import space.pxls.server.packets.socket.ServerRenameSuccess;
import space.pxls.user.User;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

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
                        final String subject = (String) profile.getAttribute("sub");
                        user = App.getUserManager().getByLogin(subject);
                        if (user == null) {
                            user = App.getUserManager().signUp(
                                (OidcProfile) profile,
                                exchange.getAttachment(IPReader.IP)
                            );
                        }

                        // update username
                        final String username = (String) profile.getAttribute("preferred_username");
                        if(user.getName() != username) {
                            user.updateUsername(username);
                            final String renamePacket = App.getGson().toJson(new ServerRenameSuccess(username));
                            user.getConnections().forEach(connection -> {
                                WebSockets.sendText(renamePacket, connection, null);
                            });
                        }

                        // update linked accounts
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
