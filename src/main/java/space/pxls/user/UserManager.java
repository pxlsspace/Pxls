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

    private void addUserToken(String token, User user) {
        usersByToken.put(token, user);
        App.getDatabase().createSession(user.getId(), token);
    }

    private void removeUserToken(String token) {
        usersByToken.remove(token);
        App.getDatabase().destroySession(token);
    }

    public User getByToken(String token) {
        User u = usersByToken.get(token);
        App.getDatabase().updateSession(token);
        if (u != null) {
            return u;
        }
        u = getByDB(App.getDatabase().getUserByToken(token));
        if (u == null) {
            return null;
        }
        usersByToken.put(token, u); // insert it in the hashmap for quicker access
        return u;
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
            user.discordName,
            user.factionBlocked
        ));
    }

    public String logIn(User user, String ip) {
        Integer uid = user.getId();
        String token = uid.toString()+"|"+ Util.generateRandomToken();
        addUserToken(token, user);
        App.getDatabase().updateUserIP(user, ip);
        return token;
    }

    public User signUp(OidcProfile profile, String ip) {
        final String username = (String) profile.getAttribute("preferred_username");
        final String subject = (String) profile.getAttribute("sub");
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

    public void logOut(String value) {
        removeUserToken(value);
    }

    public Map<String, User> getAllUsersByToken() {
        return usersByToken;
    }
}
