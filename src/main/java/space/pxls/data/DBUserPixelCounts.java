package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserPixelCounts {
    public int pixelCount;
    public int pixelCountAllTime;

    public DBUserPixelCounts(int pixelCount, int pixelCountAllTime) {
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
    }

    public static class Mapper implements RowMapper<DBUserPixelCounts> {
        @Override
        public DBUserPixelCounts map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserPixelCounts(
                r.getInt("pixel_count"),
                r.getInt("pixel_count_alltime")
            );
        }
    }
}
