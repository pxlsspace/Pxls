package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;
import space.pxls.user.User;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBChatReport {
    public final Integer id;
    public final Integer time;
    public final Integer cmid;
    public final String report_message;
    public final Integer target;
    public final Integer initiator;
    public final Integer claimed_by;
    public final Boolean closed;

    public DBChatReport(Integer id, Integer time, Integer cmid, String report_message, Integer target, Integer initiator, Integer claimed_by, Boolean closed) {
        this.id = id;
        this.time = time;
        this.cmid = cmid;
        this.report_message = report_message;
        this.target = target;
        this.initiator = initiator;
        this.claimed_by = claimed_by;
        this.closed = closed;
    }

    public String getReportedName() {
        User u = App.getUserManager().getByID(target);
        return u == null ? "" : u.getName();
    }

    public String getClaimedByName() {
        if (claimed_by == null) return "";

        User u = App.getUserManager().getByID(claimed_by);
        return u == null ? "" : u.getName();
    }

    public static class Mapper implements RowMapper<DBChatReport> {
        @Override
        public DBChatReport map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBChatReport(
                rs.getInt("id"),
                rs.getInt("time"),
                rs.getInt("cmid"),
                rs.getString("report_message"),
                rs.getInt("target"),
                rs.getInt("initiator"),
                rs.getInt("claimed_by"),
                rs.getBoolean("closed")
            );
        }
    }
}
