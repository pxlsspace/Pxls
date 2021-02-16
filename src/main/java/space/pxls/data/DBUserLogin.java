package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;

public class DBUserLogin {
    public String serviceID;
    public String serviceUserID;

    public DBUserLogin(String serviceID, String serviceUserID) {
        this.serviceID = serviceID;
        this.serviceUserID = serviceUserID;
    }

    public String getServiceID() {
        return serviceID;
    }

    public String getServiceUserID() {
        return serviceUserID;
    }

    public static class Mapper implements RowMapper<DBUserLogin> {
        @Override
        public DBUserLogin map(ResultSet r, StatementContext ctx) throws SQLException {
            return new DBUserLogin(
                r.getString("service"),
                r.getString("service_uid")
            );
        }
    }
}
