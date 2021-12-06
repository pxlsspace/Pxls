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

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Timer;
import java.util.stream.Collectors;

import org.pac4j.core.profile.CommonProfile;
import org.pac4j.http.profile.IpProfile;
import org.pac4j.oidc.profile.OidcProfile;
import org.pac4j.undertow.account.Pac4jAccount;

public class AuthReader implements HttpHandler {
    class Session {
        long issuedAt;
        long expiry;
    }

    public static AttachmentKey<User> USER = AttachmentKey.create(User.class);

    private HttpHandler next;

    // FIXME ([  ]): This is almost certainly not the correct way to manage
    // sessions. Undertow has session manager wrappers which could probably
    // be used for this. Those have the advantage of already handling timeout
    // and can be backed by a variety of storage mediums — such as db —
    // rather than being memory-only like this.

    // key is subject
    private Map<String, Session> sessions = new HashMap<String, Session>(); 

    // a minute in milliseconds
    private static int MINUTE = 1000 * 60;

    public AuthReader(HttpHandler next) {
        this.next = next;

        new Timer().schedule(new SessionTimer(this), 30 * MINUTE, 30 * MINUTE);
    }

    public void expireSessions() {
        final long time = System.currentTimeMillis();
        sessions.entrySet()
            .stream()
            .filter(e -> time > e.getValue().expiry)
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet())
            .forEach(sessions::remove);
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

                        final Session session = sessions.getOrDefault(subject, new Session());

                        final long expiry = ((Date) profile.getAttribute("exp")).getTime();
                        session.expiry = Math.max(expiry, session.expiry);

                        final long issuedAt = ((Date) profile.getAttribute("iat")).getTime();
                        if (issuedAt > session.issuedAt) {
                            session.issuedAt = issuedAt;

                            // update IP
                            // NOTE ([  ]): I guess technically the user IP
                            // isn't tied to the token at all, so this is
                            // probably wrong but the same holds for the old
                            // session system and it did this too so 🤷
                            App.getDatabase().updateUserIP(user, exchange.getAttachment(IPReader.IP));

                            // update username
                            final String username = (String) profile.getAttribute("preferred_username");
                            if (user.getName() != username) {
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
                                    
                                // TODO: it might still be worth checking if an
                                // update needs to happen before doing this.
                                user.setLinks(links);
                            }
                        }

                        sessions.put(subject, session);
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
