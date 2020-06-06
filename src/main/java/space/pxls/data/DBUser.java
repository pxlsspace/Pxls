package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.user.Role;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUser {
    public int id;
    public int stacked;
    public int chatNameColor;
    public Timestamp signup_time;
    public String username;
    public String login;
    public long cooldownExpiry;
    public Role role;
    public int pixelCount;
    public int pixelCountAllTime;
    public long banExpiry;
    public boolean isPermaChatbanned;
    public long chatbanExpiry;
    public boolean isRenameRequested;
    public String discordName;
    public String chatbanReason;
    public Integer displayedFaction;
    public Boolean factionBlocked;

    public DBUser(int id, int stacked, String username, String login, Timestamp signup, long cooldownExpiry, Role role, int pixelCount, int pixelCountAllTime, long banExpiry, boolean isPermaChatbanned, long chatbanExpiry, boolean isRenameRequested, String discordName, String chatbanReason, int chatNameColor, Integer displayedFaction, Boolean factionBlocked) {
        this.id = id;
        this.stacked = stacked;
        this.username = username;
        this.login = login;
        this.signup_time = signup;
        this.cooldownExpiry = cooldownExpiry;
        this.role = role;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banExpiry = banExpiry;
        this.isPermaChatbanned = isPermaChatbanned;
        this.chatbanExpiry = chatbanExpiry;
        this.isRenameRequested = isRenameRequested;
        this.discordName = discordName;
        this.chatbanReason = chatbanReason;
        this.chatNameColor = chatNameColor;
        this.displayedFaction = displayedFaction;
        this.factionBlocked = factionBlocked;
    }

    public static class Mapper implements RowMapper<DBUser> {
        @Override
        public DBUser map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp stamp = r.getTimestamp("cooldown_expiry");
            Timestamp ban = r.getTimestamp("ban_expiry");
            Timestamp chatban = r.getTimestamp("chat_ban_expiry");
            Integer df = null;
            try {
                df = r.getInt("displayed_faction");
            } catch (Exception ignored) {}
            return new DBUser(
                    r.getInt("id"),
                    r.getInt("stacked"),
                    r.getString("username"),
                    r.getString("login"),
                    r.getTimestamp("signup_time"),
                    stamp == null ? 0 : stamp.getTime(),
                    Role.valueOf(r.getString("role")),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    ban == null ? 0 : ban.getTime(),
                    r.getBoolean("perma_chat_banned"),
                    chatban == null ? 0 : chatban.getTime(),
                    r.getBoolean("is_rename_requested"),
                    r.getString("discord_name"),
                    r.getString("chat_ban_reason"),
                    r.getInt("chat_name_color"),
                    df,
                    r.getBoolean("faction_restricted")
            );
        }
    }
}
