package space.pxls.data;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.customizers.RegisterMapper;

import java.io.Closeable;

@RegisterMapper({DBUser.Mapper.class, DBPixelPlacement.Mapper.class, DBUserBanReason.Mapper.class})
public interface DAO extends Closeable {
    @SqlUpdate("CREATE TABLE IF NOT EXISTS pixels (" +
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT," +
            "x INT UNSIGNED NOT NULL," +
            "y INT UNSIGNED NOT NULL," +
            "color TINYINT UNSIGNED NOT NULL," +
            "who INT UNSIGNED," +
            "time TIMESTAMP NOT NULL DEFAULT now(6)," +
            "mod_action BOOLEAN NOT NULL DEFAULT false)")
    void createPixelsTable();

    @SqlUpdate("INSERT INTO pixels (x, y, color, who, mod_action) VALUES (:x, :y, :color, :who, :mod)")
    void putPixel(@Bind("x") int x, @Bind("y") int y, @Bind("color") byte color, @Bind("who") Integer who, @Bind("mod") boolean mod);

    @SqlQuery("SELECT *, users.* FROM pixels LEFT JOIN users ON pixels.who = users.id WHERE x = :x AND y = :y ORDER BY time DESC LIMIT 1")
    DBPixelPlacement getPixel(@Bind("x") int x, @Bind("y") int y);

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
            "ban_reason VARCHAR(512) NOT NULL DEFAULT '')")
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
