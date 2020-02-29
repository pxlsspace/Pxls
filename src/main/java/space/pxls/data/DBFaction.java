package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;
import space.pxls.user.User;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

public class DBFaction {
    public final int id;
    public final String name;
    public final String tag;
    public final int owner;
    public final Timestamp created;
    private transient User _cachedOwner = null;
    private transient List<User> _cachedMembers = null;

    public DBFaction(int id, String name, String tag, int owner, Timestamp created) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.owner = owner;
        this.created = created;
    }

    public User fetchOwner() {
        if (_cachedOwner == null) {
            _cachedOwner = App.getUserManager().getByID(this.owner);
        }

        return _cachedOwner;
    }

    public List<User> fetchMembers() {
        if (_cachedMembers == null) {
            _cachedMembers = App.getDatabase().getUsersForFID(this.id).stream().map(User::fromDBUser).collect(Collectors.toList());
        }

        return _cachedMembers;
    }

    public static class Mapper implements RowMapper<DBFaction> {
        @Override
        public DBFaction map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBFaction(
                    rs.getInt("id"),
                    rs.getString("name"),
                    rs.getString("tag"),
                    rs.getInt("owner"),
                    rs.getTimestamp("created")
            );
        }
    }
}
