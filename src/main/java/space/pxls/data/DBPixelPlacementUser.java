package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

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

    public DBPixelPlacementUser(int id, int x, int y, int color, long time, String username, int pixel_count, int pixel_count_alltime, String discordName) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.time = time;
        this.username = username;
        this.pixel_count = pixel_count;
        this.pixel_count_alltime = pixel_count_alltime;
        this.discordName = discordName;
    }

    public static class Mapper implements ResultSetMapper<DBPixelPlacementUser> {
        @Override
        public DBPixelPlacementUser map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");

            return new DBPixelPlacementUser(
                    r.getInt("id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    time == null ? 0 : time.getTime(),
                    r.getString("users.login").startsWith("ip:") ? "-snip-" : r.getString("users.username"),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    r.getString("users.discord_name")
            );
        }
    }
}
