package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserBanReason {
    public String ban_reason;
    public DBUserBanReason(String reason) {
        this.ban_reason = reason;
    }

    public static class Mapper implements RowMapper<DBUserBanReason> {
        @Override
        public DBUserBanReason map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserBanReason(
                    r.getString("ban_reason")
            );
        }
    }
}
