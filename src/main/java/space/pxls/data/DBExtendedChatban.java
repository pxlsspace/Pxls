package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBExtendedChatban extends DBChatban {
    public final String target_name;
    public final String initiator_name;
    public DBExtendedChatban(int id, int target, String target_name, int initiator, String initiator_name, int when, String type, int expiry, String reason, boolean purged) {
        super(id, target, initiator, when, type, expiry, reason, purged);
        this.target_name = target_name;
        this.initiator_name = initiator_name;
    }

    public static class Mapper implements RowMapper<DBExtendedChatban> {
        @Override
        public DBExtendedChatban map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBExtendedChatban(
                r.getInt("id"),
                r.getInt("target"),
                r.getString("target_name"),
                r.getInt("initiator"),
                r.getString("initiator_name"),
                r.getInt("when"),
                r.getString("type"),
                r.getInt("expiry"),
                r.getString("reason"),
                r.getBoolean("purged")
            );
        }
    }
}
