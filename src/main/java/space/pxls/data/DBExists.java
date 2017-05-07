package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBExists {
	public boolean exists;
    public DBExists() {
        this.exists = true;
    }

    public static class Mapper implements ResultSetMapper<DBExists> {
        @Override
        public DBExists map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            return new DBExists();
        }
    }
}
