package space.pxls.data;

import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUser {
    public int id;
    public int stacked;
    public String username;
    public String login;
    public long cooldownExpiry;
    public Role role;
    public long banExpiry;
    public boolean isPermaChatbanned;
    public long chatbanExpiry;
    public boolean isRenameRequested;
    public String discordName;

    public DBUser(int id, int stacked, String username, String login, long cooldownExpiry, Role role, long banExpiry, boolean isPermaChatbanned, long chatbanExpiry, boolean isRenameRequested, String discordName) {
        this.id = id;
        this.stacked = stacked;
        this.username = username;
        this.login = login;
        this.cooldownExpiry = cooldownExpiry;
        this.role = role;
        this.banExpiry = banExpiry;
        this.isPermaChatbanned = isPermaChatbanned;
        this.chatbanExpiry = chatbanExpiry;
        this.isRenameRequested = isRenameRequested;
        this.discordName = discordName;
    }

    public static class Mapper implements ResultSetMapper<DBUser> {
        @Override
        public DBUser map(int index, ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp stamp = r.getTimestamp("cooldown_expiry");
            Timestamp ban = r.getTimestamp("ban_expiry");
            Timestamp chatban = r.getTimestamp("chat_ban_expiry");
            return new DBUser(
                    r.getInt("id"),
                    r.getInt("stacked"),
                    r.getString("username"),
                    r.getString("login"),
                    stamp == null ? 0 : stamp.getTime(),
                    Role.valueOf(r.getString("role")),
                    ban == null ? 0 : ban.getTime(),
                    r.getBoolean("perma_chat_banned"),
                    chatban == null ? 0 : chatban.getTime(),
                    r.getBoolean("is_rename_requested"),
                    r.getString("discord_name")
            );
        }
    }
}
