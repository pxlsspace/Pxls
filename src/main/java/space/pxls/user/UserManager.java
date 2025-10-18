package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBUser;
import space.pxls.util.MD5;
import space.pxls.util.Util;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.pac4j.oidc.profile.OidcProfile;

public class UserManager {
    private Map<String, User> usersByToken = new ConcurrentHashMap<>();
    private Map<Integer, User> userCache = new ConcurrentHashMap<>();

    public UserManager() {

    }

    public void reload() {
        for (User u : userCache.values()) {
            u.reloadFromDatabase();
        }
        for (User u : App.getServer().getAuthedUsers().values()) {
            u.reloadFromDatabase();
        }
    }

    public User getByLogin(String login) {
        return getByDB(App.getDatabase().getUserByLogin(login));
    }

    public User getByID(int uid) {
        return getByDB(App.getDatabase().getUserByID(uid));
    }

    public User getSnipByIP(String ip) {
        return getByDB(App.getDatabase().getSnipUserByIP(ip));
    }

    private User getByDB(Optional<DBUser> optionalUser) {
        if (!optionalUser.isPresent()) return null;
        DBUser user = optionalUser.get();
        List<Role> roles = App.getDatabase().getUserRoles(user.id);
        return userCache.computeIfAbsent(user.id, (k) -> new User(
            user.id,
            user.stacked,
            user.username,
            user.login,
            user.signup_time,
            user.cooldownExpiry,
            roles,
            user.loginWithIP,
            user.pixelCount,
            user.pixelCountAllTime,
            user.banExpiry,
            user.shadowBanned,
            user.isPermaChatbanned,
            user.chatbanExpiry,
            user.chatbanReason,
            user.chatNameColor,
            user.displayedFaction,
            user.factionBlocked
        ));
    }

    public User signUp(OidcProfile profile, String ip) {
        final String username = (String) profile.getUsername();
        final String subject = (String) profile.getId();
        DBUser user = App.getDatabase().createUser(username, subject, ip);
        return getByDB(Optional.of(user));
    }

    public User signUpByIp(String ip) {
        final String iphash = MD5.compute(ip);
        DBUser user = App.getDatabase().createUser(iphash, iphash, ip);
        return getByDB(Optional.of(user));
    }

    public User getByName(String name) {
        return getByDB(App.getDatabase().getUserByName(name));
    }

    public Map<String, User> getAllUsersByToken() {
        return usersByToken;
    }
}
