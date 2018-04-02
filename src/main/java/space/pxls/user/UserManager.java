package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBUser;
import space.pxls.util.Util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class UserManager {
    private Map<String, User> usersByToken = new ConcurrentHashMap<>();
    private Map<String, String> userSignupTokens = new ConcurrentHashMap<>();
    private Map<Integer, User> userCache = new ConcurrentHashMap<>();

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

    private User getByDB(DBUser user) {
        if (user == null) return null;
        return userCache.computeIfAbsent(user.id, (k) -> new User(user.id, user.stacked, user.username, user.login, user.cooldownExpiry, user.role, user.banExpiry));
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

        if (App.getDatabase().getUserByName(name) == null) {
            DBUser user = App.getDatabase().createUser(name, login, ip);
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
