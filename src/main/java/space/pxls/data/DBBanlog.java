package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.App;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;

public class DBBanlog {
    public final int id;
    public final long when;
    public final int banner;
    public final int banned;
    public final long ban_expiry;
    public final String action;
    public final String ban_reason;

    private Optional<DBUser> bannerUser, bannedUser;

    public DBBanlog(int id, long when, int banner, int banned, long ban_expiry, String action, String ban_reason) {
        this.id = id;
        this.when = when;
        this.banner = banner;
        this.banned = banned;
        this.ban_expiry = ban_expiry;
        this.action = action;
        this.ban_reason = ban_reason;
    }

    public Optional<DBUser> getBannerUser() {
        if (bannerUser == null) bannerUser =  App.getDatabase().getUserByID(this.banner); //only request as necessary since it's another DB call. cache for the same reason.
        return bannerUser;
    }

    public Optional<DBUser> getBannedUser() {
        if (bannedUser == null) bannedUser = App.getDatabase().getUserByID(this.banned); //only request as necessary since it's another DB call. cache for the same reason.
        return bannedUser;
    }

    public static class Mapper implements RowMapper<DBBanlog> {
        @Override
        public DBBanlog map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp bannedAt = r.getTimestamp("when");
            Timestamp banExpiry = r.getTimestamp("ban_expiry");

            return new DBBanlog(
                    r.getInt("id"),
                    bannedAt == null ? 0 : bannedAt.getTime(),
                    r.getInt("banner"),
                    r.getInt("banned"),
                    banExpiry == null ? 0 : banExpiry.getTime(),
                    r.getString("action"),
                    r.getString("ban_reason")
            );
        }
    }
}
