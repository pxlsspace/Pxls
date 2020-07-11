package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

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
    //public final List<Role> roles;
    public final long ban_expiry;
    public final int pixel_count;
    public final int pixel_count_alltime;
    public final String ban_reason;
    public final boolean banned;
    public final boolean undoAction;
    public final String userAgent;
    public final String discordName;
    public final String faction;

    public DBPixelPlacement(int id, int x, int y, int color, int secondaryId, long time, int userId, String username, String login, /* List<Role> roles, */ long ban_expiry, int pixel_count, int pixel_count_alltime, String ban_reason, boolean banned, boolean undoAction, String userAgent, String discordName, String faction) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.secondaryId = secondaryId;
        this.time = time;
        this.userId = userId;
        this.username = username;
        this.login = login;
        //this.roles = roles;
        this.ban_expiry = ban_expiry;
        this.pixel_count = pixel_count;
        this.pixel_count_alltime = pixel_count_alltime;
        this.ban_reason = ban_reason;
        this.banned = banned;
        this.undoAction = undoAction;
        this.userAgent = userAgent;
        this.discordName = discordName;
        this.faction = faction;
    }

    public static class Mapper implements RowMapper<DBPixelPlacement> {
        @Override
        public DBPixelPlacement map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");
            Timestamp ban_expiry = r.getTimestamp("ban_expiry");
            String faction = null;
            try {
                faction = r.getString("faction");
            } catch (Exception ignored) {}

            return new DBPixelPlacement(
                    r.getInt("p_id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    r.getInt("secondary_id"),
                    time == null ? 0 : time.getTime(),
                    r.getInt("u_id"),
                    r.getString("username"),
                    r.getString("login"),
                    //App.getDatabase().getUserRoles(r.getInt("u_id")),
                    ban_expiry == null ? 0 : ban_expiry.getTime(),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    r.getString("ban_reason"),
                    ban_expiry != null,
                    r.getBoolean("undo_action"),
                    r.getString("user_agent"),
                    r.getString("discord_name"),
                    faction
            );
        }
    }
}
