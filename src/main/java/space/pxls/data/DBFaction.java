package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBFaction {
    public final int id;
    public final String name;
    public final String tag;
    public final int owner;
    public final Timestamp timestamp;

    public DBFaction(int id, String name, String tag, int owner, Timestamp timestamp) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.owner = owner;
        this.timestamp = timestamp;
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
