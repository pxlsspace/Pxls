package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class PixelPlacement {
    public final int x;
    public final int y;
    public final int color;
    public final String ip;

    public PixelPlacement(int x, int y, int color, String ip) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.ip = ip;
    }

    public static class Mapper implements ResultSetMapper<PixelPlacement> {
        @Override
        public PixelPlacement map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new PixelPlacement(r.getInt("x"), r.getInt('y'), r.getInt("color"), r.getString("who"));
        }
    }
}
