package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBNotification {
    public final int id;
    public final long time;
    public final long expiry;
    public final String who;
    public final String title;
    public final String content;

    public DBNotification(int id, long time, long expiry, String who, String title, String content) {
        this.id = id;
        this.time = time;
        this.expiry = expiry;
        this.who = who;
        this.title = title;
        this.content = content;
    }

    public static class Mapper implements RowMapper<DBNotification> {
        @Override
        public DBNotification map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBNotification(
                    r.getInt("id"),
                    r.getLong("time"),
                    r.getLong("expiry"),
                    r.getString("who_name"),
                    r.getString("title"),
                    r.getString("content")
            );
        }
    }
}
