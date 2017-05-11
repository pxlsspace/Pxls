package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import org.skife.jdbi.v2.Handle;
import org.skife.jdbi.v2.exceptions.NoResultsException;
import space.pxls.App;
import space.pxls.server.Packet;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static java.lang.Math.toIntExact;

public class Database implements Closeable {
    private final DBI dbi;
    
    private Map<Thread,DAO> handles = new ConcurrentHashMap<>();;

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
        config.addDataSourceProperty("allowMultiQueries", "true");

        System.out.println(new HikariDataSource(config));

        dbi = new DBI(new HikariDataSource(config));
        

        getHandle().createPixelsTable();
        getHandle().createUsersTable();
        getHandle().createSessionsTable();
        getHandle().createAdminLogTable();
        getHandle().createReportsTable();
    }

    private DAO getHandle() {
        Thread t = Thread.currentThread();
        DAO h = handles.get(t);
        if (h != null) {
            return h;
        }
        h = dbi.open(DAO.class);
        System.out.println("Creating new mariadb connection...");
        System.out.println(h);
        handles.put(t, h);
        return h;
    }

    public void placePixel(int x, int y, int color, User who, boolean mod_action) {
        getHandle().putPixel(x, y, (byte) color, who != null ? who.getId() : null, mod_action);
    }

    public void updateUserTime(int uid, long seconds) {
        getHandle().updateUserTime(uid, seconds);
    }

    public DBPixelPlacement getPixelAt(int x, int y) {
        return getHandle().getPixel(x, y);
    }

    public DBPixelPlacementUser getPixelAtUser(int x, int y) {
        return getHandle().getPixelUser(x, y);
    }

    public DBPixelPlacement getPixelByID(int id) {
        return getHandle().getPixel(id);
    }

    // returns ids of all pixels that should be rolled back and the DBPixelPlacement for all pixels to rollback to
    // DBRollbackPixel is (DBPixelPlacement and fromID) so it has all the info needed to rollback
    public List<DBRollbackPixel> getRollbackPixels(User who, int fromSeconds) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h
                .createQuery("SELECT id, secondary_id FROM pixels WHERE most_recent AND who = :who AND (time + INTERVAL :seconds SECOND > NOW())")
                .bind("who", who.getId())
                .bind("seconds", fromSeconds)
                .list(); //this selects all pixels by the banned user that are the most_recent
        List<DBRollbackPixel> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            DBPixelPlacement toPixel;
            try {
                int prevId = toIntExact((long) entry.get("secondary_id"));
                toPixel = getHandle().getPixel(prevId); //if previous pixel exists
                
                // while the user who placed the previous pixel is banned
                while (toPixel.role.lessThan(Role.GUEST) || toPixel.ban_expiry > Instant.now().toEpochMilli() || toPixel.userId == who.getId()) {
                    if (toPixel.secondaryId != 0) {
                        toPixel = getHandle().getPixel(toPixel.secondaryId); //if is banned gets previous pixel
                    } else {
                        toPixel = null; // if is banned but no previous pixel exists return blank pixel
                        break; // and no reason to loop because blank pixel isn't placed by an user
                    }
                }
            } catch (NullPointerException e) { // .get() throws NullPointerException if secondary_id is NULL
                toPixel = null; //blank pixel
            }
            pixels.add(new DBRollbackPixel(toPixel, toIntExact((long) entry.get("id")))); //add and later return
        }
        h.close();
        return pixels;
    }

    public List<DBPixelPlacement> getUndoPixels(User who) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h
                .createQuery("SELECT DISTINCT secondary_id FROM pixels WHERE rollback_action AND who = :who AND secondary_id IS NOT NULL")
                .bind("who", who.getId())
                .list(); // this selects all pixels that we previously have rolled back.
        List<DBPixelPlacement> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            int fromId = toIntExact((long) entry.get("secondary_id"));
            DBPixelPlacement fromPixel = getHandle().getPixel(fromId); // get the original pixel, the one that we previously rolled back
            
            boolean can_undo = getHandle().getCanUndo(fromPixel.x, fromPixel.y, fromPixel.id);
            if (can_undo) { // this basically checks if there are pixels that are more recent
                pixels.add(fromPixel); // add and later return
            }
        }
        h.close();
        return pixels;
    }

    public void putUndoPixel(int x, int y, int color, User who, int fromId) {
        getHandle().putUndoPixel(x, y, (byte) color, who.getId(), fromId);
    }

    public void putRollbackPixel(User who, int fromId, int toId) {
        getHandle().putRollbackPixel(who.getId(), fromId, toId);
    }

    public void putRollbackPixelNoPrevious(int x, int y, User who, int fromId) {
        getHandle().putRollbackPixelNoPrevious(x, y, who.getId(), fromId, (byte) App.getConfig().getInt("board.defaultColor"));
    }

    public DBPixelPlacement getUserUndoPixel(User who){
        return getHandle().getUserUndoPixel(who.getId());
    }

    public void putUserUndoPixel(DBPixelPlacement backPixel, User who, int fromId) {
        getHandle().putUserUndoPixel(backPixel.x, backPixel.y, (byte) backPixel.color, who.getId(), backPixel.id, fromId);
    }

    public void putUserUndoPixel(int x, int y, int color, User who, int fromId) {
        getHandle().putUserUndoPixel(x, y, (byte) color, who.getId(), 0, fromId);
    }

    public void close() {
        getHandle().close();
    }

    public DBUser getUserByLogin(String login) {
        return getHandle().getUserByLogin(login);
    }

    public DBUser getUserByName(String name) {
        return getHandle().getUserByName(name);
    }

    public DBUser getUserByToken(String token) {
        return getHandle().getUserByToken(token);
    }

    public DBUser createUser(String name, String login, String ip) {
        getHandle().createUser(name, login, ip);
        return getUserByName(name);
    }

    public void createSession(int who, String token) {
        getHandle().createSession(who, token);
    }

    public void destroySession(String token) {
        getHandle().destroySession(token);
    }

    public void updateSession(String token) {
        getHandle().updateSession(token);
    }

    public void setUserRole(User user, Role role) {
        getHandle().updateUserRole(user.getId(), role.name());
    }

    public void updateBan(User user, long timeFromNowSeconds, String reason) {
        getHandle().updateUserBan(user.getId(), timeFromNowSeconds, reason);
    }

    public void updateBanReason(User user, String reason) {
        getHandle().updateUserBanReason(user.getId(), reason);
    }

    public void updateUserIP(User user, String ip) {
        getHandle().updateUserIP(user.getId(), ip);
    }

    public String getUserBanReason(int id) {
        return getHandle().getUserBanReason(id).ban_reason;
    }

    public void clearOldSessions() {
        getHandle().clearOldSessions();
    }

    public boolean didPixelChange(int x, int y) {
        return getHandle().didPixelChange(x, y);
    }

    public void adminLog(String message, int uid) {
        getHandle().adminLog(message, uid);
    }

    public void adminLogServer(String message) {
        getHandle().adminLogServer(message);
    }

    public void addReport(int who, int pixel_id, int x, int y, String message) {
        getHandle().addReport(who, pixel_id, x, y, message);
    }
}
