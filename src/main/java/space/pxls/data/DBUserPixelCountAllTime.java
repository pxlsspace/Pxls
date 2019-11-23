package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserPixelCountAllTime {
    public int pixel_count_alltime;
    public DBUserPixelCountAllTime(int count) {
        this.pixel_count_alltime = count;
    }

    public static class Mapper implements RowMapper<DBUserPixelCountAllTime> {
        @Override
        public DBUserPixelCountAllTime map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserPixelCountAllTime(
                    r.getInt("pixel_count_alltime")
            );
        }
    }
}
