package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBFactionMembership {
    public final int fid;
    public final int uid;

    public DBFactionMembership(int fid, int uid) {
        this.fid = fid;
        this.uid = uid;
    }

    public static class Mapper implements RowMapper<DBFactionMembership> {
        @Override
        public DBFactionMembership map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBFactionMembership(
                rs.getInt("fid"),
                rs.getInt("uid")
            );
        }
    }
}
