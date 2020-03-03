package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;

public class DBFaction {
    public final int id;
    public final String name;
    public final String tag;
    public final int color;
    public final int owner;
    public final Timestamp created;
    private final Boolean displayed;

    public DBFaction(int id, String name, String tag, int color, int owner, Timestamp created) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.color = color;
        this.owner = owner;
        this.created = created;
        this.displayed = null;
    }

    public DBFaction(int id, String name, String tag, int color, int owner, Timestamp created, Boolean displayed) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.color = color;
        this.owner = owner;
        this.created = created;
        this.displayed = displayed;
    }

    public Optional<Boolean> isDisplayed() {
        return Optional.ofNullable(displayed);
    }

    public static class Mapper implements RowMapper<DBFaction> {
        @Override
        public DBFaction map(ResultSet rs, StatementContext ctx) throws SQLException {
            Boolean displayed = null;
            try {
                displayed = rs.getBoolean("displayed");
            } catch (Exception ignored) {
            }
            if (displayed != null) {
                return new DBFaction(
                    rs.getInt("id"),
                    rs.getString("name"),
                    rs.getString("tag"),
                    rs.getInt("color"),
                    rs.getInt("owner"),
                    rs.getTimestamp("created"),
                    displayed
                );
            } else {
                return new DBFaction(
                    rs.getInt("id"),
                    rs.getString("name"),
                    rs.getString("tag"),
                    rs.getInt("color"),
                    rs.getInt("owner"),
                    rs.getTimestamp("created")
                );
            }
        }
    }
}
