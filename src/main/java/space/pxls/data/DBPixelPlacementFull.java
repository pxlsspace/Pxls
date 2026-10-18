package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBPixelPlacementFull extends DBPixelPlacement {
    public final int secondaryId;
    public final boolean undoAction;

    public DBPixelPlacementFull(
        int id,
        int x,
        int y,
        int color,
        long time,
        boolean modAction,
        int userId,
        int secondaryId,
        boolean undoAction
    ) {
        super(
            id,
            x,
            y,
            color,
            time,
            modAction,
            userId
        );
        this.secondaryId = secondaryId;
        this.undoAction = undoAction;
    }

    public static class Mapper implements RowMapper<DBPixelPlacementFull> {
        @Override
        public DBPixelPlacementFull map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBPixelPlacementFull(
                    r.getInt("id"),
                    r.getInt("x"),
                    r.getInt("y"),
                    r.getInt("color"),
                    r.getTimestamp("time").getTime(),
                    r.getBoolean("mod_action"),
                    r.getInt("who"),
                    r.getInt("secondary_id"),
                    r.getBoolean("undo_action")
            );
        }
    }
}
