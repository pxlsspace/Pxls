package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserPixelCount {
    public int pixel_count;
    public DBUserPixelCount(int count) {
        this.pixel_count = count;
    }

    public static class Mapper implements ResultSetMapper<DBUserPixelCount> {
        @Override
        public DBUserPixelCount map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserPixelCount(
                    r.getInt("pixel_count")
            );
        }
    }
}
