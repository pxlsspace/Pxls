package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBChatban {
    public final int id;
    public final int target;
    public final int initiator;
    public final int when;
    public final String type;
    public final int expiry;
    public final String reason;
    public final boolean purged;

    public DBChatban(int id, int target, int initiator, int when, String type, int expiry, String reason, boolean purged) {
        this.id = id;
        this.target = target;
        this.initiator = initiator;
        this.when = when;
        this.type = type;
        this.expiry = expiry;
        this.reason = reason;
        this.purged = purged;
    }

    public static class Mapper implements RowMapper<DBChatban> {
        @Override
        public DBChatban map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBChatban(
                    r.getInt("id"),
                    r.getInt("target"),
                    r.getInt("initiator"),
                    r.getInt("when"),
                    r.getString("type"),
                    r.getInt("expiry"),
                    r.getString("reason"),
                    r.getBoolean("purged")
            );
        }
    }
}
