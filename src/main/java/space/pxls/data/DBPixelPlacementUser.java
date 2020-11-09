package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBPixelPlacementUser {
    public final int id;
    public final int x;
    public final int y;
    public final int color;
    public final long time;
    public final String username;
    public final int pixel_count;
    public final int pixel_count_alltime;
    public final String discordName;
    public final String faction;

    public DBPixelPlacementUser(int id, int x, int y, int color, long time, String username, int pixel_count, int pixel_count_alltime, String discordName, String faction) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.time = time;
        this.username = username;
        this.pixel_count = pixel_count;
        this.pixel_count_alltime = pixel_count_alltime;
        this.discordName = discordName;
        this.faction = faction;
    }

    public static class Mapper implements RowMapper<DBPixelPlacementUser> {
        @Override
        public DBPixelPlacementUser map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");
            String faction = null;
            try {
                faction = r.getString("faction");
            } catch (Exception ignored) {}

            return new DBPixelPlacementUser(
                    r.getInt("p_id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    time == null ? 0 : time.getTime(),
                    r.getBoolean("login_with_ip") ? "-snip-" : r.getString("username"),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    r.getString("discord_name"),
                    faction
            );
        }
    }
}
