package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBChatMessage {
    public final String nonce;
    public final int author_uid;
    public final Long sent;
    public final String content;
    public final String filtered_content;
    public final boolean purged;
    public final int purged_by_uid;

    public DBChatMessage(String nonce, int author_uid, Long sent, String content, String filtered_content, boolean purged, int purged_by_uid) {
        this.nonce = nonce;
        this.author_uid = author_uid;
        this.sent = sent;
        this.content = content;
        this.filtered_content = filtered_content;
        this.purged = purged;
        this.purged_by_uid = purged_by_uid;
    }

    public static class Mapper implements RowMapper<DBChatMessage> {
        @Override
        public DBChatMessage map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBChatMessage(
                    r.getString("nonce"),
                    r.getInt("author"),
                    r.getLong("sent"),
                    r.getString("content"),
                    r.getString("filtered"),
                    r.getBoolean("purged"),
                    r.getInt("purged_by")
            );
        }
    }
}
