package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;
import space.pxls.user.User;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBCanvasReport {
    public final Integer id;
    public final Integer who;
    public final Integer x;
    public final Integer y;
    public final Integer pixel_id;
    public final Integer reported;
    public final Integer claimed_by;
    public final Integer time;
    public final Boolean closed;
    public final String message;

    public DBCanvasReport(Integer id, Integer who, Integer x, Integer y, Integer pixel_id, Integer reported, Integer claimed_by, Integer time, Boolean closed, String message) {
        this.id = id;
        this.who = who;
        this.x = x;
        this.y = y;
        this.pixel_id = pixel_id;
        this.reported = reported;
        this.claimed_by = claimed_by;
        this.time = time;
        this.closed = closed;
        this.message = message;
    }

    public String getReportedName() {
        User u = App.getUserManager().getByID(reported);
        return u == null ? "" : u.getName();
    }

    public String getClaimedByName() {
        if (claimed_by == null) return "";

        User u = App.getUserManager().getByID(claimed_by);
        return u == null ? "" : u.getName();
    }

    public static class Mapper implements RowMapper<DBCanvasReport> {
        @Override
        public DBCanvasReport map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBCanvasReport(
                rs.getInt("id"),
                rs.getInt("who"),
                rs.getInt("x"),
                rs.getInt("y"),
                rs.getInt("pixel_id"),
                rs.getInt("reported"),
                rs.getInt("claimed_by"),
                rs.getInt("time"),
                rs.getBoolean("closed"),
                rs.getString("message")
            );
        }
    }
}
