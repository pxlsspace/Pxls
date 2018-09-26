package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import org.skife.jdbi.v2.Handle;
import org.skife.jdbi.v2.sqlobject.mixins.GetHandle;
import space.pxls.App;
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
    
    private Map<Thread,DatabaseHandle> handles = new ConcurrentHashMap<>();;

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
        config.setMaximumPoolSize(200); // this is plenty, the websocket uses 32

        dbi = new DBI(new HikariDataSource(config));
        

        getHandle().createPixelsTable();
        getHandle().createUsersTable();
        getHandle().createSessionsTable();
        getHandle().createLookupsTable();
        getHandle().createAdminLogTable();
        getHandle().createReportsTable();
        getHandle().createStatsTable();
        getHandle().createAdminNotesTable();
    }

    private DAO getHandle() {
        Thread t = Thread.currentThread();
        DatabaseHandle h = handles.get(t);
        if (h != null) {
            h.lastUse = System.currentTimeMillis();
            return h.dao;
        }
        h = new DatabaseHandle();
        h.dao = dbi.open(DAO.class);
        h.lastUse = System.currentTimeMillis();
        System.out.println("Creating new mariadb connection...");
        System.out.println(h);
        handles.put(t, h);
        return h.dao;
    }

    public void cleanup() {
        for (Thread t : handles.keySet()) {
            DatabaseHandle d = handles.get(t);
            if (d.lastUse + (1000 * 60 * 5)  < System.currentTimeMillis()) {
                // ok destroy it
                System.out.println("Destroying mariadb connection...");
                System.out.println(d.dao);
                d.dao.close();
                handles.remove(t);
            }
        }
    }

    public void placePixel(int x, int y, int color, User who, boolean mod_action) {
        int second_id = getHandle().getMostResentId(x, y);
        getHandle().putPixel(x, y, (byte) color, who != null ? who.getId() : 0, mod_action, second_id);
    }

    public void updateUserTime(int uid, long seconds) {
        getHandle().updateUserTime(uid, seconds);
    }

    public DBPixelPlacement getPixelAt(int x, int y) {
        DBPixelPlacement pp;
        try {
            pp = getHandle().getPixel(x, y);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && pp.userId == 0) {
            return null;
        }
        return pp;
    }

    public DBPixelPlacementUser getPixelAtUser(int x, int y) {
        DBPixelPlacementUser pp;
        try {
            pp = getHandle().getPixelUser(x, y);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && (pp.username == null || pp.username.isEmpty())) {
            return null;
        }
        return pp;
    }

    public DBPixelPlacement getPixelByID(int id) {
        DBPixelPlacement pp;
        try {
            pp = getHandle().getPixel(id);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && pp.userId == 0) {
            return null;
        }
        return pp;
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

                // while the user who placed the previous pixel is banned or previous pixel was undone
                while (toPixel.role.lessThan(Role.GUEST) || toPixel.ban_expiry > Instant.now().toEpochMilli() || toPixel.userId == who.getId() || toPixel.undoAction) {
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
        getHandle().putRollbackPixelNoPrevious(x, y, who.getId(), fromId, App.getDefaultColor(x, y));
    }

    public void putNukePixel(int x, int y, int color) {
        DBPixelPlacement pp = getPixelAt(x, y);
        getHandle().putNukePixel(x, y, color, pp != null ? pp.userId : 0, pp != null ? (pp.secondaryId > 0) : false);
    }

    public void putNukePixel(int x, int y, int replace, int color) {
        DBPixelPlacement pp = getPixelAt(x, y);
        getHandle().putReplacePixel(x, y, replace, color, pp != null ? pp.userId : 0, pp != null ? (pp.secondaryId > 0) : false);
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

    public void updateBan(User user, long timeFromNowSeconds) {
        getHandle().updateUserBan(user.getId(), timeFromNowSeconds);
    }

    public void updateBanReason(User user, String reason) {
        getHandle().updateUserBanReason(user.getId(), reason);
    }

    public void updateUseragent(User user, String agent) {
        getHandle().updateUseragent(user.getId(), agent);
    }

    public void updateUserIP(User user, String ip) {
        getHandle().updateUserIP(user.getId(), ip);
    }

    public void updateUserStacked(User user, int stacked) {
        getHandle().updateUserStacked(user.getId(), stacked);
    }

    public String getUserBanReason(int id) {
        return getHandle().getUserBanReason(id).ban_reason;
    }

    public int getUserPixels(int id) {
        return getHandle().getUserPixels(id).pixel_count;
    }

    public void clearOldSessions() {
        getHandle().clearOldSessions();
    }

    public boolean didPixelChange(int x, int y) {
        return getHandle().didPixelChange(x, y);
    }

    public boolean shouldPixelTimeIncrease(int x, int y, int who) {
        return App.getConfig().getBoolean("selfPixelTimeIncrease") ? didPixelChange(x, y) : getHandle().shouldPixelTimeIncrease(x, y, who);
    }

    public void adminLog(String message, int uid) {
        getHandle().adminLog(message, uid);
    }

    public void adminLogServer(String message) {
        getHandle().adminLogServer(message);
    }

    public void addReport(int whosReporting, int userReported, int pixel_id, int x, int y, String message) {
        getHandle().addReport(whosReporting, userReported, pixel_id, x, y, message);
    }

    public void addServerReport(String message, int reported) {
        getHandle().addServerReport(message, reported);
    }

    public boolean haveDupeIp(String ip, int uid) {
        return getHandle().haveDupeIp(ip, uid);
    }

    public boolean userLastIPAlerted(User u) {
        return userLastIPAlerted(u.getId());
    }

    public boolean userLastIPAlerted(int uid) {
        return getHandle().userLastIPAlerted(uid);
    }

    public void addLookup(Integer who, String ip) {
        getHandle().putLookup(who, ip);
    }

    public void doLastIPAlert(User user) {
        getHandle().flagLastIPAlertedOnUID(user.getId());
        getHandle().addServerReport("User is on the same network as someone else's last known network(s)", user.getId());
    }

    class DatabaseHandle {
        public DAO dao;
        public long lastUse;
    }
}
