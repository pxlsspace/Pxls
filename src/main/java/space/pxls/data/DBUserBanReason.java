package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserBanReason {
    public String ban_reason;
    public DBUserBanReason(String reason) {
        this.ban_reason = reason;
    }

    public static class Mapper implements ResultSetMapper<DBUserBanReason> {
        @Override
        public DBUserBanReason map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserBanReason(
                    r.getString("ban_reason")
            );
        }
    }
}
