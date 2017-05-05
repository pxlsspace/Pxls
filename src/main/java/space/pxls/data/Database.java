package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import org.skife.jdbi.v2.Handle;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;
import java.time.Instant;
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

    public void placePixel(int x, int y, int color, User who, boolean mod_action) {
        handle.putPixel(x, y, (byte) color, who != null ? who.getId() : null, mod_action);

        if (who != null) {
            handle.updateUserTime(who.getId());
        }
    }

    public DBPixelPlacement getPixelAt(int x, int y) {
        return handle.getPixel(x, y);
    }

    public DBPixelPlacement getPixelByID(int id){
        return handle.getPixel(id);
    }


    public List<DBRollbackPixel> getRollbackPixels(User who, int fromSeconds) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h
                .createQuery("SELECT id, secondary_id FROM pixels WHERE most_recent AND who = :who AND (time + INTERVAL :seconds SECOND > NOW())")
                .bind("who", who.getId())
                .bind("seconds", fromSeconds)
                .list();
        List<DBRollbackPixel> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            int prevId = toIntExact((long) entry.get("secondary_id"));
            DBPixelPlacement toPixel = handle.getPixel(prevId);
            while (toPixel.role.lessThan(Role.GUEST) || toPixel.banExpiry > Instant.now().toEpochMilli() || toPixel.userId == who.getId()) {
                if (toPixel.secondaryId != 0) {
                    toPixel = handle.getPixel(toPixel.secondaryId);
                } else {
                    toPixel = null;
                    break;
                }
            }
            pixels.add(new DBRollbackPixel(toPixel, toIntExact((long) entry.get("id"))));
        }
        h.close();
        return pixels;
    }

    public void putRollbackPixel(User who, int fromId, int toId) {
        handle.putRollbackPixel(who.getId(), fromId, toId);
    }

    public void putRollbackPixelNoPrevious(int x, int y, User who, int fromId) {
        handle.putRollbackPixelNoPrevious(x, y, who.getId(), fromId);
    }

    public void updateCurrentPixel(int id, boolean isCurrent) {
        handle.updateCurrentPixel(id, isCurrent);
    }

    public void updateCurrentPixel(int x, int y, int id) {
        handle.updateCurrentPixel(x, y, id);
    }

    public List<DBPixelPlacement> getRollbackPixels(User who) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h.createQuery("SELECT * FROM rollback_pixels WHERE who = :who").bind("who", who.getId()).list();
        List<DBPixelPlacement> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {

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
