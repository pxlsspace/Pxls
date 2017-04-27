package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBUser;
import space.pxls.data.DBUserBanReason;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

public class UserManager {
    private Map<String, User> usersByToken = new ConcurrentHashMap<>();
    private Map<String, String> userSignupTokens = new ConcurrentHashMap<>();

    private Map<Integer, User> userCache = new ConcurrentHashMap<>();

    public UserManager() {

    }

    private static String generateRandom() {
        String charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        Random rand = new Random();
        StringBuilder res = new StringBuilder();
        for (int i = 0; i <= 32; i++) {
            int randIndex = rand.nextInt(charset.length());
            res.append(charset.charAt(randIndex));
        }
        return res.toString();
    }

    public User getByToken(String token) {
        return usersByToken.get(token);
    }

    public User getByLogin(String login) {
        return getByDB(App.getDatabase().getUserByLogin(login));
    }

    private User getByDB(DBUser user) {
        if (user == null) return null;
        return userCache.computeIfAbsent(user.id, (k) -> new User(user.id, user.username, user.login, user.lastPlaceTime, user.role, user.banExpiry));
    }

    public String logIn(User user, String ip) {
        String token = generateRandom();
        usersByToken.put(token, user);
        App.getDatabase().updateUserIP(user, ip);
        return token;
    }

    public String generateUserCreationToken(String login) {
        String token = generateRandom();
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
        usersByToken.remove(value);
    }

    public void shadowBanUser(User user, String reason) {
        App.getDatabase().updateBanReason(user, reason);
        App.getDatabase().setUserRole(user, Role.SHADOWBANNED);
        user.setRole(Role.SHADOWBANNED);
    }

    public void shadowBanUser(User user) {
        shadowBanUser(user, "");
    }

    public void banUser(User user, long timeFromNowSeconds, String reason) {
        App.getDatabase().updateBan(user, timeFromNowSeconds, reason);
        user.setBanExpiryTime(timeFromNowSeconds * 1000 + System.currentTimeMillis());
    }

    public void banUser(User user, long timeFromNowSeconds) {
        banUser(user, timeFromNowSeconds, "");
    }

    public void unbanUser(User user) {
        banUser(user, 0);
        App.getDatabase().setUserRole(user, Role.USER);
        user.setRole(Role.USER);
    }

    public void permaBanUser(User user, String reason) {
        App.getDatabase().updateBanReason(user, reason);
        App.getDatabase().setUserRole(user, Role.BANNED);
        user.setRole(Role.BANNED);
    }
}
