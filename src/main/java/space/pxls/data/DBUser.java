package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUser {
    public int id;
    public String username;
    public String login;
    public long lastPlaceTime;

    public DBUser(int id, String username, String login, long lastPlaceTime) {
        this.id = id;
        this.username = username;
        this.login = login;
        this.lastPlaceTime = lastPlaceTime;
    }

    public static class Mapper implements ResultSetMapper<DBUser> {
        @Override
        public DBUser map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUser(r.getInt("id"), r.getString("username"), r.getString("login"), 0);
        }
    }
}
