package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUser {
    public int id;
    public int stacked;
    public String username;
    public String login;
    public long cooldownExpiry;
    public Role role;
    public long banExpiry;

    public DBUser(int id, int stacked, String username, String login, long cooldownExpiry, Role role, long banExpiry) {
        this.id = id;
        this.stacked = stacked;
        this.username = username;
        this.login = login;
        this.cooldownExpiry = cooldownExpiry;
        this.role = role;
        this.banExpiry = banExpiry;
    }

    public static class Mapper implements ResultSetMapper<DBUser> {
        @Override
        public DBUser map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp stamp = r.getTimestamp("cooldown_expiry");
            Timestamp ban = r.getTimestamp("ban_expiry");
            return new DBUser(
                    r.getInt("id"),
                    r.getInt("stacked"),
                    r.getString("username"),
                    r.getString("login"),
                    stamp == null ? 0 : stamp.getTime(),
                    Role.valueOf(r.getString("role")),
                    ban == null ? 0 : ban.getTime()
            );
        }
    }
}
