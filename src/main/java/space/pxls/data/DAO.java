package space.pxls.data;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.customizers.RegisterMapper;

import java.io.Closeable;

@RegisterMapper({DBUser.Mapper.class, DBPixelPlacement.Mapper.class, DBPixelPlacementUser.Mapper.class, DBUserBanReason.Mapper.class})
public interface DAO extends Closeable {
    @SqlUpdate("CREATE TABLE IF NOT EXISTS pixels (" +
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT," +
            "x INT UNSIGNED NOT NULL," +
            "y INT UNSIGNED NOT NULL," +
            "color TINYINT UNSIGNED NOT NULL," +
            "who INT UNSIGNED," +
            "secondary_id INT UNSIGNED," + //is previous pixel's id normally, is the id that was changed from for rollback action, is NULL if there's no previous or it was undo of rollback
            "time TIMESTAMP NOT NULL DEFAULT now(6)," +
            "mod_action BOOLEAN NOT NULL DEFAULT false," +
            "rollback_action BOOLEAN NOT NULL DEFAULT false," +
            "most_recent BOOLEAN NOT NULL DEFAULT true)") //is true and is the only thing we alter
    void createPixelsTable();


    @SqlUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, mod_action)" +
            "VALUES (:x, :y, :color, :who, (SELECT id FROM pixels AS pp WHERE pp.x = :x AND pp.y = :y AND pp.most_recent),  :mod);" +
            "UPDATE pixels SET most_recent = false WHERE x = :x AND y = :y AND NOT id = LAST_INSERT_ID();" +
            "IF NOT :mod THEN UPDATE users SET pixel_count = pixel_count + 1 WHERE id = :who; END IF;")
    void putPixel(@Bind("x") int x, @Bind("y") int y, @Bind("color") byte color, @Bind("who") int who, @Bind("mod") boolean mod);

    @SqlUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, rollback_action, most_recent)" +
            "SELECT x, y, color, :who, :from_id, true, false FROM pixels AS pp WHERE pp.id = :to_id;" +
            "UPDATE pixels SET most_recent = true WHERE id = :to_id;" +
            "UPDATE pixels SET most_recent = false WHERE id = :from_id;" +
            "UPDATE users SET pixel_count = IF(pixel_count, pixel_count-1, 0) WHERE id = :who")
    void putRollbackPixel(@Bind("who") int who, @Bind("from_id") int fromId, @Bind("to_id") int toId);

    @SqlUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, rollback_action, most_recent)" +
            "VALUES (:x, :y, :default_color, :who, :from_id, true, false);" +
            "UPDATE pixels SET most_recent = false WHERE x = :x and y = :y;" +
            "UPDATE users SET pixel_count = IF(pixel_count, pixel_count-1, 0) WHERE id = :who")
    void putRollbackPixelNoPrevious(@Bind("x") int x, @Bind("y") int y, @Bind("who") int who, @Bind("from_id") int fromId, @Bind("default_color") byte defaultColor);

    @SqlUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, rollback_action, most_recent)" +
            "VALUES (:x, :y, :color, :who, NULL, true, false);" +
            "UPDATE pixels SET most_recent = true WHERE id = :from_id;" +
            "UPDATE users SET pixel_count = pixel_count + 1 WHERE id = :who")
    void putUndoPixel(@Bind("x") int x, @Bind("y") int y, @Bind("color") byte color, @Bind("who") int who, @Bind("from_id") int fromId);

    @SqlQuery("SELECT *, users.* FROM pixels LEFT JOIN users ON pixels.who = users.id WHERE x = :x AND y = :y ORDER BY time DESC LIMIT 1")
    DBPixelPlacement getPixel(@Bind("x") int x, @Bind("y") int y);

    @SqlQuery("SELECT pixels.id, pixels.x, pixels.y, pixels.color, pixels.time, users.username, users.pixel_count FROM pixels LEFT JOIN users ON pixels.who = users.id WHERE x = :x AND y = :y ORDER BY time DESC LIMIT 1")
    DBPixelPlacementUser getPixelUser(@Bind("x") int x, @Bind("y") int y);

    @SqlQuery("SELECT *, users.* FROM pixels LEFT JOIN users on pixels.who = users.id WHERE pixels.id = :id")
    DBPixelPlacement getPixel(@Bind("id") int id);

    @SqlQuery("SELECT NOT EXISTS(SELECT 1 FROM pixels WHERE x = :x AND y = :y AND most_recent AND id > :id)")
    boolean getCanUndo(@Bind("x") int x, @Bind("y") int y, @Bind("id") int id);

    @SqlUpdate("CREATE TABLE IF NOT EXISTS users (" +
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT," +
            "username VARCHAR(32) NOT NULL," +
            "login VARCHAR(64) NOT NULL," +
            "signup_time TIMESTAMP NOT NULL DEFAULT now(6)," +
            "last_pixel_time TIMESTAMP," +
            "role VARCHAR(16) NOT NULL DEFAULT 'USER'," +
            "ban_expiry TIMESTAMP," +
            "signup_ip BINARY(16)," +
            "last_ip BINARY(16)," +
            "ban_reason VARCHAR(512) NOT NULL DEFAULT ''," +
            "pixel_count INT UNSIGNED NOT NULL DEFAULT 0)")
    void createUsersTable();

    @SqlUpdate("UPDATE users SET last_pixel_time = now(6) WHERE id = :id")
    void updateUserTime(@Bind("id") int userId);

    @SqlUpdate("UPDATE users SET role = :role WHERE id = :id")
    void updateUserRole(@Bind("id") int userId, @Bind("role") String newRole);

    @SqlUpdate("UPDATE users SET ban_expiry = now() + INTERVAL :expiry SECOND, ban_reason = :ban_reason WHERE id = :id")
    void updateUserBan(@Bind("id") int id, @Bind("expiry") long expiryFromNow, @Bind("ban_reason") String reason);

    @SqlUpdate("UPDATE users SET ban_reason = :ban_reason WHERE id = :id")
    void updateUserBanReason(@Bind("id") int id, @Bind("ban_reason") String reason);

    @SqlUpdate("UPDATE users SET last_ip = INET6_ATON(:ip) WHERE id = :id")
    void updateUserIP(@Bind("id") int id, @Bind("ip") String ip);

    @SqlUpdate("INSERT INTO users (username, login, signup_ip, last_ip) VALUES (:username, :login, INET6_ATON(:ip), INET6_ATON(:ip))")
    void createUser(@Bind("username") String username, @Bind("login") String login, @Bind("ip") String ip);

    @SqlQuery("SELECT * FROM users WHERE login = :login")
    DBUser getUserByLogin(@Bind("login") String login);

    @SqlQuery("SELECT * FROM users WHERE username = :name")
    DBUser getUserByName(@Bind("name") String name);

    @SqlQuery("SELECT ban_reason FROM users WHERE id = :id")
    DBUserBanReason getUserBanReason(@Bind("id") int userId);

    @SqlUpdate("CREATE TABLE IF NOT EXISTS sessions ("+
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,"+
            "who INT UNSIGNED NOT NULL,"+
            "token VARCHAR(60) NOT NULL,"+
            "time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)")
    void createSessionsTable();

    @SqlQuery("SELECT * FROM users INNER JOIN sessions ON users.id = sessions.who WHERE sessions.token = :token")
    DBUser getUserByToken(@Bind("token") String token);

    @SqlUpdate("INSERT INTO sessions (who, token) VALUES (:who, :token)")
    void createSession(@Bind("who") int who, @Bind("token") String token);

    @SqlUpdate("DELETE FROM sessions WHERE token = :token")
    void destroySession(@Bind("token") String token);

    @SqlUpdate("UPDATE sessions SET time=CURRENT_TIMESTAMP WHERE token = :token")
    void updateSession(@Bind("token") String token);

    void close();
}
