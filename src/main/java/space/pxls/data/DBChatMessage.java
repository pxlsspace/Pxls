package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBChatMessage {
    public final int id;
    public final int author_uid;
    public final Long sent;
    public final String content;
    public final String filtered_content;
    public final int replying_to_id;
    public final boolean reply_should_mention;
    public final boolean purged;
    public final int purged_by_uid;
    public final String purge_reason;
    public final boolean author_was_shadow_banned;

    public DBChatMessage(int id, int author_uid, Long sent, String content, String filtered_content, int replying_to_id, boolean reply_should_mention, boolean purged, int purged_by_uid, String purge_reason, boolean author_was_shadow_banned) {
        this.id = id;
        this.author_uid = author_uid;
        this.sent = sent;
        this.content = content;
        this.filtered_content = filtered_content;
        this.replying_to_id = replying_to_id;
        this.reply_should_mention = reply_should_mention;
        this.purged = purged;
        this.purged_by_uid = purged_by_uid;
        this.purge_reason = purge_reason;
        this.author_was_shadow_banned = author_was_shadow_banned;
    }

    public static class Mapper implements RowMapper<DBChatMessage> {
        @Override
        public DBChatMessage map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBChatMessage(
                    r.getInt("id"),
                    r.getInt("author"),
                    r.getLong("sent"),
                    r.getString("content"),
                    r.getString("filtered"),
                    r.getInt("replying_to_id"),
                    r.getBoolean("reply_should_mention"),
                    r.getBoolean("purged"),
                    r.getInt("purged_by"),
                    r.getString("purge_reason"),
                    r.getBoolean("shadow_banned")
            );
        }
    }
}
