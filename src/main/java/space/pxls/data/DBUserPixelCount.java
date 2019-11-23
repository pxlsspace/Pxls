package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserPixelCount {
    public int pixel_count;
    public DBUserPixelCount(int count) {
        this.pixel_count = count;
    }

    public static class Mapper implements RowMapper<DBUserPixelCount> {
        @Override
        public DBUserPixelCount map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserPixelCount(
                    r.getInt("pixel_count")
            );
        }
    }
}
