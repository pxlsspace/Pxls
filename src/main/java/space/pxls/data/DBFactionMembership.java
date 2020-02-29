package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;
import space.pxls.user.User;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBFactionMembership {
    public final int fid;
    public final int uid;
    public final boolean displayed;
    private DBFaction _cachedFaction = null;
    private User _cachedUser = null;

    public DBFactionMembership(int fid, int uid, boolean displayed) {
        this.fid = fid;
        this.uid = uid;
        this.displayed = displayed;
    }

    public DBFaction fetchFaction() {
        if (_cachedFaction == null) {
            _cachedFaction = App.getDatabase().getFactionByID(this.fid);
        }

        return _cachedFaction;
    }

    public User fetchUser() {
        if (_cachedUser == null) {
            _cachedUser = App.getUserManager().getByID(this.uid);
        }

        return _cachedUser;
    }

    public static class Mapper implements RowMapper<DBFactionMembership> {
        @Override
        public DBFactionMembership map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBFactionMembership(
                rs.getInt("fid"),
                rs.getInt("uid"),
                rs.getBoolean("displayed")
            );
        }
    }
}
