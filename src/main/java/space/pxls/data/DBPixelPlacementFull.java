package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import space.pxls.App;
import space.pxls.auth.Provider;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;

public class DBPixelPlacementFull extends DBPixelPlacement {
    public final int secondaryId;
    public final int userId;
    public final long ban_expiry;
    public final String ban_reason;
    public final boolean banned;
    public final boolean undoAction;
    public final String userAgent;
    public final List<Provider> logins;

    public DBPixelPlacementFull(
        int id,
        int x,
        int y,
        int color,
        int secondaryId,
        long time,
        int userId,
        String username,
        List<Provider> logins,
        long ban_expiry,
        int pixelCount,
        int pixelCountAlltime,
        String ban_reason,
        boolean banned,
        boolean modAction,
        boolean undoAction,
        String userAgent,
        String discordName,
        String faction
    ) {
        super(
            id,
            x,
            y,
            color,
            time,
            username,
            modAction,
            pixelCount,
            pixelCountAlltime,
            discordName,
            faction
        );
        this.secondaryId = secondaryId;
        this.userId = userId;
        this.ban_expiry = ban_expiry;
        this.ban_reason = ban_reason;
        this.banned = banned;
        this.undoAction = undoAction;
        this.userAgent = userAgent;
        this.logins = logins;
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

            final List<Provider> logins = App.getDatabase().getUserLinks(r.getInt("u_id"));
            logins.add(new Provider(r.getString("username"), r.getString("sub"), "pxls"));

            return new DBPixelPlacementFull(
                    r.getInt("p_id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    r.getInt("secondary_id"),
                    time == null ? 0 : time.getTime(),
                    r.getInt("u_id"),
                    r.getString("username"),
                    logins,
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
