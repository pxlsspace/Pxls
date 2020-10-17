package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBPixelPlacement {
    public final int id;
    public final int x;
    public final int y;
    public final int color;
    public final long time;
    public final boolean modAction;
    public final String username;
    public final Integer pixelCount;
    public final Integer pixelCountAlltime;
    public final String discordName;
    public final String faction;

    public DBPixelPlacement(int id, int x, int y, int color, long time, String username, boolean modAction, int pixelCount, int pixelCountAlltime, String discordName, String faction) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.time = time;
        this.modAction = modAction;
        this.username = username;
        this.pixelCount = pixelCount;
        this.pixelCountAlltime = pixelCountAlltime;
        this.discordName = discordName;
        this.faction = faction;
    }

    public static class Mapper implements RowMapper<DBPixelPlacement> {
        @Override
        public DBPixelPlacement map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");
            String faction = null;
            try {
                faction = r.getString("faction");
            } catch (Exception ignored) {}

            return new DBPixelPlacement(
                    r.getInt("p_id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    time == null ? 0 : time.getTime(),
                    r.getString("u_login").startsWith("ip:") ? "-snip-" : r.getString("username"),
                    r.getBoolean("mod_action"),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    r.getString("discord_name"),
                    faction
            );
        }
    }
}
