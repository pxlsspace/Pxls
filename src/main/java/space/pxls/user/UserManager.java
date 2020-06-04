package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBUser;
import space.pxls.util.Util;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class UserManager {
    private Map<String, User> usersByToken = new ConcurrentHashMap<>();
    private Map<String, String> userSignupTokens = new ConcurrentHashMap<>();

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

    private User getByDB(Optional<DBUser> optionalUser) {
        if (!optionalUser.isPresent()) return null;
        DBUser user = optionalUser.get();
        return userCache.computeIfAbsent(user.id, (k) -> new User(user.id, user.stacked, user.username, user.login, user.signup_time, user.cooldownExpiry, user.role, user.pixelCount, user.pixelCountAllTime, user.banExpiry, user.isPermaChatbanned, user.chatbanExpiry, user.chatbanReason, user.chatNameColor, user.displayedFaction, user.discordName, user.factionBlocked));
    }

    public String logIn(User user, String ip) {
        Integer uid = user.getId();
        String token = uid.toString()+"|"+ Util.generateRandomToken();
        addUserToken(token, user);
        App.getDatabase().updateUserIP(user, ip);
        return token;
    }

    public String generateUserCreationToken(String login) {
        String token = Util.generateRandomToken();
        userSignupTokens.put(token, login);
        return token;
    }

    public boolean isValidSignupToken(String token) {
        return userSignupTokens.containsKey(token);
    }

    public User signUp(String name, String token, String ip) {
        String login = userSignupTokens.get(token);
        if (login == null) return null;

        if (!App.getDatabase().getUserByName(name).isPresent()) {
            Optional<DBUser> user = App.getDatabase().createUser(name, login, ip);
            userSignupTokens.remove(token);
            return getByDB(user);
        }
        return null;
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
