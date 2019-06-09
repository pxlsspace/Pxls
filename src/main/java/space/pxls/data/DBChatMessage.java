package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBChatMessage {
    public final int author_uid;
    public final long sent_at;
    public final String message;
    public final String nonce;

    public DBChatMessage(String nonce, int author_uid, long sent_at, String message) {
        this.author_uid = author_uid;
        this.sent_at = sent_at;
        this.message = message;
        this.nonce = nonce;
    }

    public static class Mapper implements ResultSetMapper<DBChatMessage> {
        @Override
        public DBChatMessage map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp sentAt = r.getTimestamp("sent");
            return new DBChatMessage(
                    r.getString("nonce"),
                    r.getInt("author"),
                    sentAt == null ? 0 : sentAt.getTime(),
                    r.getString("message")
            );
        }
    }
}
