package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import org.skife.jdbi.v2.Handle;
import space.pxls.App;
import space.pxls.server.Packet;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static java.lang.Math.toIntExact;

public class Database implements Closeable {
    private final DBI dbi;
    private final DAO handle;

    public Database() {
        try {
            Class.forName("org.mariadb.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(App.getConfig().getString("database.url"));
        config.setUsername(App.getConfig().getString("database.user"));
        config.setPassword(App.getConfig().getString("database.pass"));
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");

        dbi = new DBI(new HikariDataSource(config));
        handle = dbi.open(DAO.class);

        handle.createPixelsTable();
        handle.createUsersTable();
        handle.createSessionsTable();
    }

    public void placePixel(int x, int y, int color, int prev, User who, boolean mod_action, boolean rollback_action) {
        handle.putPixel(x, y, (byte) color, (byte) prev, who != null ? who.getId() : null, mod_action, rollback_action);

        if (who != null) {
            handle.updateUserTime(who.getId());
        }
    }

    public DBPixelPlacement getPixelAt(int x, int y) {
        return handle.getPixel(x, y);
    }

    public List<Packet.ServerPlace.Pixel> getPreviousPixels(User who, boolean isUndo, int fromSeconds) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h.createQuery("SELECT x, y, prev_color FROM pixels AS p WHERE p.who = :who AND p.rollback_action = :undo AND p.time + INTERVAL :seconds SECOND > NOW() AND NOT EXISTS(SELECT 1 FROM pixels AS pp INNER JOIN users AS uu ON uu.id = pp.id WHERE p.x=pp.x AND p.y=pp.y AND pp.id > p.id AND NOT pp.rollback_action AND pp.who != :who AND NOT (uu.ban_expiry > NOW() OR uu.role = 'BANNED' OR uu.role = 'SHADOWBANNED')) GROUP BY x, y;").bind("who", who.getId()).bind("undo", isUndo).bind("seconds", fromSeconds).list();
        List<Packet.ServerPlace.Pixel> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            int x = toIntExact((long) entry.get("x"));
            int y = toIntExact((long) entry.get("y"));
            int color = (int) entry.get("prev_color");
            pixels.add(new Packet.ServerPlace.Pixel(x, y, color));
        }
        h.close();
        return pixels;
    }

    public void close() {
        handle.close();
    }

    public DBUser getUserByLogin(String login) {
        return handle.getUserByLogin(login);
    }

    public DBUser getUserByName(String name) {
        DBUser user = handle.getUserByName(name);
        if (user == null) return null;
        return user;
    }

    public DBUser getUserByToken(String token) {
        return handle.getUserByToken(token);
    }

    public DBUser createUser(String name, String login, String ip) {
        handle.createUser(name, login, ip);
        return getUserByName(name);
    }

    public void createSession(int who, String token) {
        handle.createSession(who, token);
    }

    public void destroySession(String token) {
        handle.destroySession(token);
    }

    public void updateSession(String token) {
        handle.updateSession(token);
    }

    public void setUserRole(User user, Role role) {
        handle.updateUserRole(user.getId(), role.name());
    }

    public void updateBan(User user, long timeFromNowSeconds, String reason) {
        handle.updateUserBan(user.getId(), timeFromNowSeconds, reason);
    }

    public void updateBanReason(User user, String reason) {
        handle.updateUserBanReason(user.getId(), reason);
    }

    public void updateUserIP(User user, String ip) {
        handle.updateUserIP(user.getId(), ip);
    }

    public String getUserBanReason(int id) {
        return handle.getUserBanReason(id).ban_reason;
    }
}
