package space.pxls.data;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.customizers.RegisterMapper;

import java.io.Closeable;

@RegisterMapper({DBUser.Mapper.class, PixelPlacement.Mapper.class})
public interface DAO extends Closeable {
    @SqlUpdate("CREATE TABLE IF NOT EXISTS pixels (" +
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT," +
            "x INT UNSIGNED NOT NULL," +
            "y INT UNSIGNED NOT NULL," +
            "color TINYINT UNSIGNED NOT NULL," +
            "who INT UNSIGNED NOT NULL," +
            "time TIMESTAMP NOT NULL DEFAULT now(6)," +
            "mod_action BOOLEAN NOT NULL DEFAULT false)")
    void createPixelsTable();

    @SqlUpdate("INSERT INTO pixels (x, y, color, who, mod_action) VALUES (:x, :y, :color, :who, :mod)")
    void putPixel(@Bind("x") int x, @Bind("y") int y, @Bind("color") byte color, @Bind("who") int who, @Bind("mod") boolean mod);

    @SqlQuery("SELECT * FROM pixels WHERE x = :x AND y = :y ORDER BY time DESC LIMIT 1")
    PixelPlacement getPixel(@Bind("x") int x, @Bind("y") int y);

    @SqlUpdate("CREATE TABLE IF NOT EXISTS users (" +
            "id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT," +
            "username VARCHAR(32) NOT NULL," +
            "login VARCHAR(64) NOT NULL," +
            "signup_time TIMESTAMP NOT NULL DEFAULT now(6)," +
            "last_pixel_time TIMESTAMP," +
            "role VARCHAR(16) NOT NULL DEFAULT 'USER'," +
            "ban_expiry TIMESTAMP)")
    void createUsersTable();

    @SqlUpdate("UPDATE users SET last_pixel_time = now(6) WHERE id = :id")
    void updateUserTime(@Bind("id") int userId);

    @SqlUpdate("UPDATE users SET role = :role WHERE id = :id")
    void updateUserRole(@Bind("id") int userId, @Bind("role") String newRole);

    @SqlUpdate("UPDATE users SET ban_expiry = now() + :expiry WHERE id = :id")
    void updateUserBan(@Bind("id") int id, @Bind("expiry") long expiryFromNow);

    @SqlUpdate("INSERT INTO users (username, login) VALUES (:username, :login)")
    void createUser(@Bind("username") String username, @Bind("login") String login);

    @SqlQuery("SELECT * FROM users WHERE login = :login")
    DBUser getUserByLogin(@Bind("login") String login);

    @SqlQuery("SELECT * FROM users WHERE username = :name")
    DBUser getUserByName(@Bind("name") String name);

    @SqlUpdate("CREATE TABLE IF NOT EXISTS ips (id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT, user INT REFERENCES users(user)), ip TEXT, last_activity NUMERIC DEFAULT now(6)")
    void createIpsTable();

    @SqlUpdate("INSERT OR REPLACE INTO ips (id, USER, ip, last_activity) VALUES ((SELECT id FROM ips WHERE USER = :USER AND ip = :ip), :USER, :ip, now(6))")
    void updateIPActivity(int user, String ip);

    void close();
}
