package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;

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

    public DBUser createUser(String name, String login, String ip) {
        handle.createUser(name, login, ip);
        return getUserByName(name);
    }

    public void setUserRole(User user, Role role) {
        handle.updateUserRole(user.getId(), role.name());
    }

    public void updateBan(User user, long timeFromNowSeconds, String reason) {
        handle.updateUserBan(user.getId(), timeFromNowSeconds, reason);
    }

    public void updateUserIP(User user, String ip) {
        handle.updateUserIP(user.getId(), ip);
    }

    public String getUserBanReason(int id) {
        return handle.getUserBanReason(id).ban_reason;
    }
}
