package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBPixelPlacement {
    public final int id;
    public final int x;
    public final int y;
    public final int color;
    public final int secondaryId;
    public final long time;
    public final int userId;
    public final String username;
    public final String login;
    public final Role role;
    public final long ban_expiry;
    public final int pixel_count;
    public final String ban_reason;
    public final boolean banned;
    public final boolean undoAction;

    public DBPixelPlacement(int id, int x, int y, int color, int secondaryId, long time, int userId, String username, String login, Role role, long ban_expiry, int pixel_count, String ban_reason, boolean banned, boolean undoAction) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.secondaryId = secondaryId;
        this.time = time;
        this.userId = userId;
        this.username = username;
        this.login = login;
        this.role = role;
        this.ban_expiry = ban_expiry;
        this.pixel_count = pixel_count;
        this.ban_reason = ban_reason;
        this.banned = banned;
        this.undoAction = undoAction;
    }

    public static class Mapper implements ResultSetMapper<DBPixelPlacement> {
        @Override
        public DBPixelPlacement map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");
            Timestamp ban_expiry = r.getTimestamp("users.ban_expiry");
            boolean banned = Role.valueOf(r.getString("users.role")) == Role.BANNED;
            if (!banned && ban_expiry != null) {
                banned = ban_expiry.getTime() > System.currentTimeMillis();
            }

            return new DBPixelPlacement(
                    r.getInt("id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    r.getInt("secondary_id"),
                    time == null ? 0 : time.getTime(),
                    r.getInt("users.id"),
                    r.getString("users.username"),
                    r.getString("users.login"),
                    Role.valueOf(r.getString("users.role")), // TODO: all users might not have valid roles
                    ban_expiry == null ? 0 : ban_expiry.getTime(),
                    r.getInt("pixel_count"),
                    r.getString("users.ban_reason"),
                    banned,
                    r.getBoolean("undo_action")
            );
        }
    }
}
