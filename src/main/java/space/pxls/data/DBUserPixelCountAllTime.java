package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUserPixelCountAllTime {
    public int pixel_count_alltime;
    public DBUserPixelCountAllTime(int count) {
        this.pixel_count_alltime = count;
    }

    public static class Mapper implements ResultSetMapper<DBUserPixelCountAllTime> {
        @Override
        public DBUserPixelCountAllTime map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserPixelCountAllTime(
                    r.getInt("pixel_count_alltime")
            );
        }
    }
}
