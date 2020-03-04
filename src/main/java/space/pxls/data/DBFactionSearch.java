package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBFactionSearch {
    public final int id;
    public final String name;
    public final String tag;
    public final int color;
    public final int owner;
    public final int canvasCode;
    public final int memberCount;
    public final Timestamp created;

    public DBFactionSearch(int id, String name, String tag, int color, int owner, Timestamp created, int canvasCode, int memberCount) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.color = color;
        this.owner = owner;
        this.created = created;
        this.canvasCode = canvasCode;
        this.memberCount = memberCount;
    }

    public static class Mapper implements RowMapper<DBFactionSearch> {
        @Override
        public DBFactionSearch map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new DBFactionSearch(
                rs.getInt("id"),
                rs.getString("name"),
                rs.getString("tag"),
                rs.getInt("color"),
                rs.getInt("owner"),
                rs.getTimestamp("created"),
                rs.getInt("canvasCode"),
                rs.getInt("memberCount")
            );
        }
    }
}
