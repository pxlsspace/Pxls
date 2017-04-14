package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBPixelPlacement {
    public final int x;
    public final int y;
    public final int color;
    public final long time;
    public final String username;
    public final String login;

    public DBPixelPlacement(int x, int y, int color, long time, String username, String login) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.time = time;
        this.username = username;
        this.login = login;
    }

    public static class Mapper implements ResultSetMapper<DBPixelPlacement> {
        @Override
        public DBPixelPlacement map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp time = r.getTimestamp("time");

            return new DBPixelPlacement(
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    time == null ? 0 : time.getTime(),
                    r.getString("users.username"),
                    r.getString("users.login")
            );
        }
    }
}
