package space.pxls.data;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class DBUser {
    public int id;
    public int stacked;
    public Timestamp signup_time;
    public String username;
    public long cooldownExpiry;
    public boolean loginWithIP;
    public String signupIP;
    public int pixelCount;
    public int pixelCountAllTime;
    public Long banExpiry;
    public boolean shadowBanned;
    public boolean isRenameRequested;
    public String discordName;
    public Integer displayedFaction;
    public Boolean factionBlocked;
    public Boolean twitchSubbed;

    public DBUser(int id, int stacked, String username, Timestamp signup, long cooldownExpiry, boolean loginWithIP, String signupIP, int pixelCount, int pixelCountAllTime, Long banExpiry, boolean shadowBanned, boolean isRenameRequested, String discordName, Integer displayedFaction, Boolean factionBlocked, Boolean twitchSubbed) {
        this.id = id;
        this.stacked = stacked;
        this.username = username;
        this.signup_time = signup;
        this.cooldownExpiry = cooldownExpiry;
        this.loginWithIP = loginWithIP;
        this.signupIP = signupIP;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banExpiry = banExpiry;
        this.shadowBanned = shadowBanned;
        this.isRenameRequested = isRenameRequested;
        this.discordName = discordName;
        this.displayedFaction = displayedFaction;
        this.factionBlocked = factionBlocked;
        this.twitchSubbed = twitchSubbed;
    }

    public static class Mapper implements RowMapper<DBUser> {
        @Override
        public DBUser map(ResultSet r, StatementContext ctx) throws SQLException {
            Timestamp stamp = r.getTimestamp("cooldown_expiry");
            Timestamp ban = r.getTimestamp("ban_expiry");
            Integer df = null;
            try {
                df = r.getInt("displayed_faction");
            } catch (Exception ignored) {}
            return new DBUser(
                    r.getInt("id"),
                    r.getInt("stacked"),
                    r.getString("username"),
                    r.getTimestamp("signup_time"),
                    stamp == null ? 0 : stamp.getTime(),
                    r.getBoolean("login_with_ip"),
                    r.getString("signup_ip"),
                    r.getInt("pixel_count"),
                    r.getInt("pixel_count_alltime"),
                    ban == null ? null : ban.getTime(),
                    r.getBoolean("is_shadow_banned"),
                    r.getBoolean("is_rename_requested"),
                    r.getString("discord_name"),
                    df,
                    r.getBoolean("faction_restricted"),
                    r.getBoolean("twitch_subbed")
            );
        }
    }
}
