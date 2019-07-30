package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBChatMessage {
    public final String nonce;
    public final int author_uid;
    public final Long sent;
    public final String content;
    public final int purged;
    public final int purged_by_uid;

    public DBChatMessage(String nonce, int author_uid, Long sent, String content, int purged, int purged_by_uid) {
        this.nonce = nonce;
        this.author_uid = author_uid;
        this.sent = sent;
        this.content = content;
        this.purged = purged;
        this.purged_by_uid = purged_by_uid;
    }

    public static class Mapper implements ResultSetMapper<DBChatMessage> {
        @Override
        public DBChatMessage map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBChatMessage(
                    r.getString("nonce"),
                    r.getInt("author"),
                    r.getLong("sent"),
                    r.getString("content"),
                    r.getInt("purged"),
                    r.getInt("purged_by")
            );
        }
    }
}
