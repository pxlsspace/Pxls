package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUser {
    public int id;
    public String username;
    public String login;
    public long lastPlaceTime;
    public Role role;

    public DBUser(int id, String username, String login, long lastPlaceTime, Role role) {
        this.id = id;
        this.username = username;
        this.login = login;
        this.lastPlaceTime = lastPlaceTime;
        this.role = role;
    }

    public static class Mapper implements ResultSetMapper<DBUser> {
        @Override
        public DBUser map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp stamp = r.getTimestamp("last_pixel_time");
            return new DBUser(
                    r.getInt("id"),
                    r.getString("username"),
                    r.getString("login"),
                    stamp == null ? 0 : stamp.getTime(),
                    Role.valueOf(r.getString("role"))
            );
        }
    }
}
