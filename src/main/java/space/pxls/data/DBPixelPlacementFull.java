package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBPixelPlacementFull extends DBPixelPlacement {
    public final int secondaryId;
    public final int userId;
    public final String login;
    //public final List<Role> roles;
    public final long ban_expiry;
    public final String ban_reason;
    public final boolean banned;
    public final boolean undoAction;
    public final String userAgent;

    public DBPixelPlacementFull(int id, int x, int y, int color, int secondaryId, long time, int userId, String username, String login, /* List<Role> roles, */ long ban_expiry, int pixelCount, int pixelCountAlltime, String ban_reason, boolean banned, boolean modAction, boolean undoAction, String userAgent, String discordName, String faction) {
        super(id, x, y, color, time, username, modAction, pixelCount, pixelCountAlltime, discordName, faction);
        this.secondaryId = secondaryId;
        this.userId = userId;
        this.login = login;
        //this.roles = roles;
        this.ban_expiry = ban_expiry;
        this.ban_reason = ban_reason;
        this.banned = banned;
        this.undoAction = undoAction;
        this.userAgent = userAgent;
    }

    public static class Mapper implements RowMapper<DBPixelPlacementFull> {
        @Override
        public DBPixelPlacementFull map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");
            Timestamp ban_expiry = r.getTimestamp("ban_expiry");
            String faction = null;
            try {
                faction = r.getString("faction");
            } catch (Exception ignored) {}

            return new DBPixelPlacementFull(
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
                    r.getBoolean("mod_action"),
                    r.getBoolean("undo_action"),
                    r.getString("user_agent"),
                    r.getString("discord_name"),
                    faction
            );
        }
    }
}
