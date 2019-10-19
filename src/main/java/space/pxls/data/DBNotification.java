package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.App;
import space.pxls.user.User;

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

    public static class Mapper implements ResultSetMapper<DBNotification> {
        @Override
        public DBNotification map(int index, ResultSet r, StatementContext ctx) throws SQLException {
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
