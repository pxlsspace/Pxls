package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import space.pxls.App;
import space.pxls.user.User;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBPixelPlacement {
    public final int id;
    public final int x;
    public final int y;
    public final int color;
    public final long time;
    public final boolean modAction;
    public final int userId;

    public DBPixelPlacement(
        int id,
        int x,
        int y,
        int color,
        long time,
        boolean modAction,
        int userId
    ) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.time = time;
        this.modAction = modAction;
        this.userId = userId;
    }

    public User getUser() {
        return App.getUserManager().getByID(userId);
    }

    public static class Mapper implements RowMapper<DBPixelPlacement> {
        @Override
        public DBPixelPlacement map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBPixelPlacement(
                    r.getInt("id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    r.getTimestamp("time").getTime(),
                    r.getBoolean("mod_action"),
                    r.getInt("who")
            );
        }
    }
}
