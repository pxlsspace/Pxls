package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

import space.pxls.App;
import space.pxls.server.packets.chat.ChatMessage;
import space.pxls.server.packets.chat.ServerChatLookup;
import space.pxls.user.Chatban;
import space.pxls.user.Faction;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.user.UserLogin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import java.util.AbstractMap.SimpleEntry;

import static java.lang.Math.toIntExact;

public class Database {
    private final Jdbi jdbi;
    private static final String SQL_USER_BY_NAME = "SELECT id, stacked, username, signup_time, cooldown_expiry, ban_expiry, is_shadow_banned, login_with_ip, signup_ip, last_ip, last_ip_alert, perma_chat_banned, chat_ban_expiry, chat_ban_reason, ban_reason, user_agent, pixel_count, pixel_count_alltime, is_rename_requested, discord_name, chat_name_color, displayed_faction, faction_restricted FROM users WHERE username = :username";

    public Database() {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(App.getConfig().getString("database.url"));
        config.setUsername(App.getConfig().getString("database.user"));
        config.setPassword(App.getConfig().getString("database.pass"));
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        config.addDataSourceProperty("allowMultiQueries", "true");
        config.setMaximumPoolSize(200); // this is plenty, the websocket uses 32
        //config.setConnectionInitSql("SET NAMES UTF-8"); //needed for emoji's in chat

        jdbi = Jdbi.create(new HikariDataSource(config));

        jdbi.useHandle(handle -> {
            // pixels
            handle.createUpdate("CREATE TABLE IF NOT EXISTS pixels (" +
                    "id BIGSERIAL NOT NULL PRIMARY KEY," +
                    "x INT NOT NULL," +
                    "y INT NOT NULL," +
                    "color SMALLINT NOT NULL," +
                    "who INT," +
                    "secondary_id BIGINT," + //is previous pixel's id normally, is the id that was changed from for rollback action, is NULL if there's no previous or it was undo of rollback
                    "time TIMESTAMP NOT NULL DEFAULT NOW()," +
                    "mod_action BOOL NOT NULL DEFAULT false," +
                    "rollback_action BOOL NOT NULL DEFAULT false," +
                    "undone BOOL NOT NULL DEFAULT false," +
                    "undo_action BOOL NOT NULL DEFAULT false," +
                    "most_recent BOOL NOT NULL DEFAULT true);" +
                    "CREATE INDEX IF NOT EXISTS pos ON pixels (x,y);" +
                    "CREATE INDEX IF NOT EXISTS most_recent ON pixels (most_recent)")
                .execute();
            // users
            handle.createUpdate("CREATE TABLE IF NOT EXISTS users (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "username VARCHAR(32) UNIQUE NOT NULL," +
                    "signup_time TIMESTAMP NOT NULL DEFAULT NOW()," +
                    "cooldown_expiry TIMESTAMP," +
                    "ban_expiry TIMESTAMP," +
                    "is_shadow_banned BOOL NOT NULL DEFAULT false," +
                    "signup_ip INET," +
                    "last_ip INET," +
                    "last_ip_alert BOOL NOT NULL DEFAULT false," +
                    "login_with_ip BOOL NOT NULL DEFAULT false," +
                    "perma_chat_banned BOOL DEFAULT false," +
                    "chat_ban_expiry TIMESTAMP DEFAULT NOW()," +
                    "chat_ban_reason TEXT," +
                    "ban_reason VARCHAR(512) NOT NULL DEFAULT ''," +
                    "pixel_count INT NOT NULL DEFAULT 0," +
                    "pixel_count_alltime INT NOT NULL DEFAULT 0," +
                    "user_agent VARCHAR(512) NOT NULL DEFAULT ''," +
                    "stacked INT DEFAULT 0," +
                    "is_rename_requested BOOL NOT NULL DEFAULT false," +
                    "discord_name VARCHAR(37)," +
                    "chat_name_color INT NOT NULL," +
                    "displayed_faction INT," +
                    "faction_restricted BOOLEAN NOT NULL DEFAULT false)")
                    .execute();
            // roles
            handle.createUpdate("CREATE TABLE IF NOT EXISTS roles (" +
                    "id INTEGER REFERENCES users," +
                    "role VARCHAR(512)," +
                    "PRIMARY KEY (id, role))")
                    .execute();
            // user logins
            handle.createUpdate("CREATE TABLE IF NOT EXISTS user_logins (" +
                    "uid INT NOT NULL REFERENCES users(id)," +
                    "service VARCHAR(16) NOT NULL," +
                    "service_uid VARCHAR(64) NOT NULL);" +
                    "CREATE UNIQUE INDEX IF NOT EXISTS _user_logins_method_sid_pair ON user_logins(service, service_uid);")
                    .execute();
            // user keys
            handle.createUpdate("CREATE TABLE IF NOT EXISTS user_keys (" +
                    "uid INT NOT NULL REFERENCES users(id)," +
                    "key CHAR(512) NOT NULL," +
                    "canvas_code VARCHAR(64) NOT NULL);" +
                    "CREATE UNIQUE INDEX IF NOT EXISTS _user_keys_uid_canvas_code_pair ON user_keys(uid, canvas_code);")
                    .execute();
            // sessions
            handle.createUpdate("CREATE TABLE IF NOT EXISTS sessions ("+
                    "id SERIAL NOT NULL PRIMARY KEY,"+
                    "who INT NOT NULL,"+
                    "token VARCHAR(60) NOT NULL,"+
                    "time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);" +
                    "CREATE INDEX IF NOT EXISTS token ON sessions (token)")
                    .execute();
            // lookups
            handle.createUpdate("CREATE TABLE IF NOT EXISTS lookups (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "who INT," +
                    "time TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                    "ip INET," +
                    "pixel INT REFERENCES pixels(id))")
                    .execute();
            // admin_log
            handle.createUpdate("CREATE TABLE IF NOT EXISTS admin_log (" +
                    "id BIGSERIAL PRIMARY KEY," +
                    "channel VARCHAR(255)," +
                    "level INT," +
                    "message TEXT," +
                    "time INT," +
                    "userid INT)")
                    .execute();
            // reports
            handle.createUpdate("CREATE TABLE IF NOT EXISTS reports (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "who INT," +
                    "x INT," +
                    "y INT," +
                    "message TEXT," +
                    "pixel_id INT," +
                    "reported INT," +
                    "claimed_by INT NOT NULL DEFAULT 0," +
                    "closed BOOL NOT NULL DEFAULT false," +
                    "time INT DEFAULT NULL)")
                    .execute();
            // stats
            handle.createUpdate("CREATE TABLE IF NOT EXISTS stats (" +
                    "id SERIAL NOT NULL PRIMARY KEY, " +
                    "channel VARCHAR(20) NOT NULL DEFAULT '0', " +
                    "value INT NOT NULL, " +
                    "timestamp INT NOT NULL)")
                    .execute();
            // admin_notes
            handle.createUpdate("CREATE TABLE IF NOT EXISTS admin_notes (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "user_id INT NOT NULL," +
                    "target_id INT NOT NULL," +
                    "reply_to INT DEFAULT NULL," +
                    "message TEXT NOT NULL," +
                    "timestamp INT NOT NULL)")
                    .execute();
            // banlogs
            handle.createUpdate("CREATE TABLE IF NOT EXISTS banlogs (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "\"when\" INT NOT NULL," +
                    "banner INT NOT NULL," +
                    "banned INT NOT NULL," +
                    "ban_expiry INT DEFAULT 0," +
                    "action VARCHAR(256) NOT NULL," +
                    "ban_reason VARCHAR(512) NOT NULL)")
                    .execute();
            // chat_messages
            handle.createUpdate("CREATE TABLE IF NOT EXISTS chat_messages (" +
                    "id BIGSERIAL PRIMARY KEY," +
                    "author INT," +
                    "sent BIGINT NOT NULL," +
                    "content VARCHAR(2048) NOT NULL," +
                    "filtered VARCHAR(2048) NOT NULL DEFAULT ''," +
                    "replying_to_id BIGINT NOT NULL DEFAULT 0," +
                    "reply_should_mention BOOL NOT NULL DEFAULT true," +
                    "purged BOOL NOT NULL DEFAULT false," +
                    "purged_by INT," +
                    "purge_reason TEXT," +
                    "shadow_banned BOOL NOT NULL DEFAULT false)")
                    .execute();
            // chat_reports
            handle.createUpdate("CREATE TABLE IF NOT EXISTS chat_reports (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "time INT DEFAULT NULL," +
                    "cmid BIGINT NOT NULL," +
                    "report_message TEXT NOT NULL," +
                    "target INT NOT NULL," +
                    "initiator INT NOT NULL," +
                    "claimed_by INT NOT NULL default 0," +
                    "closed BOOL NOT NULL default false)")
                    .execute();
            // ip_log
            handle.createUpdate("CREATE TABLE IF NOT EXISTS ip_log (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "\"user\" INT NOT NULL," +
                    "ip INET NOT NULL," +
                    "last_used TIMESTAMP NOT NULL DEFAULT NOW());" +
                    "CREATE UNIQUE INDEX IF NOT EXISTS \"ip_log_user_ip_pair\" ON \"ip_log\" (\"user\", \"ip\")")
                    .execute();
            // notifications
            handle.createUpdate("CREATE TABLE IF NOT EXISTS notifications (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "time INT NOT NULL," +
                    "expiry INT DEFAULT NULL," +
                    "title TEXT NOT NULL," +
                    "content TEXT NOT NULL," +
                    "who INT NOT NULL)")
                    .execute();
            // chatbans
            handle.createUpdate("CREATE TABLE IF NOT EXISTS chatbans (" +
                    "id SERIAL NOT NULL PRIMARY KEY," +
                    "target INT NOT NULL," +
                    "initiator INT NOT NULL," +
                    "\"when\" INT NOT NULL," +
                    "type VARCHAR(256) NOT NULL," +
                    "expiry INT," +
                    "reason TEXT NOT NULL," +
                    "purged BOOL NOT NULL);")
                    .execute();
            // factions
            handle.createUpdate("CREATE TABLE IF NOT EXISTS faction (" +
                "  id SERIAL NOT NULL PRIMARY KEY," +
                "  name TEXT NOT NULL," +
                "  tag TEXT NOT NULL," +
                "  color INT NOT NULL DEFAULT 0," +
                "  owner INT NOT NULL REFERENCES users(id)," +
                "  created TIMESTAMP NOT NULL DEFAULT NOW()," +
                "  \"canvasCode\" VARCHAR(256) NOT NULL DEFAULT 0" +
                ");" +
                "CREATE INDEX IF NOT EXISTS _faction_name ON faction (\"name\");" +
                "CREATE INDEX IF NOT EXISTS _faction_tag ON faction (tag);" +
                "CREATE INDEX IF NOT EXISTS _owner ON faction (owner);")
                .execute();
            handle.createUpdate("CREATE TABLE IF NOT EXISTS faction_membership (" +
                "  fid INT NOT NULL REFERENCES faction(id)," +
                "  uid INT NOT NULL REFERENCES users(id)" +
                ");" +
                "CREATE INDEX IF NOT EXISTS _faction_membership_fid ON faction_membership(fid);" +
                "CREATE INDEX IF NOT EXISTS _faction_membership_uuid ON faction_membership(uid);" +
                "CREATE UNIQUE INDEX IF NOT EXISTS _faction_membership_uid_fid_pair ON faction_membership(uid, fid);")
                .execute();
            handle.createUpdate("CREATE TABLE IF NOT EXISTS faction_ban (" +
                "  fid INT NOT NULL REFERENCES faction(id)," +
                "  uid INT NOT NULL REFERENCES users(id)" +
                ");" +
                "CREATE INDEX IF NOT EXISTS _faction_ban_fid ON faction_ban(fid);" +
                "CREATE INDEX IF NOT EXISTS _faction_ban_uuid ON faction_ban(uid);" +
                "CREATE UNIQUE INDEX IF NOT EXISTS _faction_ban_uid_fid_pair ON faction_ban(uid, fid);")
                .execute();
        });
    }

    /**
     * Places a pixel.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @param color The pixel's color.
     * @param who Who placed the pixel.
     * @param mod_action Whether or not the pixel is a mod action.
     */
    public Integer placePixel(int x, int y, int color, User who, boolean mod_action) {
        return jdbi.withHandle(handle -> {
            Optional<Integer> second_id = handle.select("SELECT id FROM pixels AS pp WHERE pp.x = :x AND pp.y = :y AND pp.most_recent ORDER BY id DESC LIMIT 1")
                    .bind("x", x)
                    .bind("y", y)
                    .mapTo(Integer.class)
                    .findFirst();
            int whoID = who != null ? who.getId() : 0;
            handle.createUpdate("UPDATE pixels SET most_recent = false WHERE x = :x AND y = :y")
                    .bind("x", x)
                    .bind("y", y)
                    .execute();
            int rowID = handle.createUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, mod_action) VALUES (:x, :y, :color, :who, :second_id, :mod)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("color", color)
                    .bind("who", whoID)
                    .bind("second_id", second_id)
                    .bind("mod", mod_action)
                    .execute();
            return rowID;
        });
    }

    /**
     * Updates the user cooldown expiry.
     * @param id The user's ID.
     * @param seconds The amount of seconds until the cooldown expires.
     */
    public void updateUserTime(int id, long seconds) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET cooldown_expiry = NOW() + :seconds * '1 SECOND'::INTERVAL WHERE id = :id")
                .bind("seconds", seconds)
                .bind("id", id)
                .execute());
    }

    /**
     * Gets all pixel and user information at the coordinates.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @return The pixel and user information.
     */
    public Optional<DBPixelPlacementFull> getFullPixelAt(int x, int y) {
        Optional<DBPixelPlacementFull> pp;
        try {
            pp = jdbi.withHandle(handle -> handle.select("SELECT p.id as p_id, p.x, p.y, p.color, p.secondary_id, p.time, p.mod_action, p.undo_action, u.id as u_id, u.username, u.login_with_ip, u.ban_expiry, u.is_shadow_banned, u.pixel_count, u.pixel_count_alltime, u.ban_reason, u.user_agent, u.discord_name, f.name as \"faction\" FROM pixels p LEFT JOIN users u ON p.who = u.id LEFT OUTER JOIN faction f ON f.id = u.displayed_faction WHERE p.x = :x AND p.y = :y AND p.most_recent ORDER BY p.time DESC LIMIT 1")
                    .bind("x", x)
                    .bind("y", y)
                    .map(new DBPixelPlacementFull.Mapper())
                    .findFirst());
        } catch (NullPointerException e) {
            return Optional.empty();
        }
        return pp;
    }

    /**
     * Gets basic pixel and user information from the coordinates.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @return The pixel and user information.
     */
    public Optional<DBPixelPlacement> getPixelAt(int x, int y) {
        Optional<DBPixelPlacement> pp;
        try {
            pp = jdbi.withHandle(handle -> handle.select("SELECT p.id as p_id, p.x, p.y, p.color, p.time, p.mod_action, u.id as u_id, u.username, u.ban_expiry, u.is_shadow_banned, u.pixel_count, u.pixel_count_alltime, u.login_with_ip, u.discord_name, f.name as \"faction\" FROM pixels p LEFT JOIN users u ON p.who = u.id LEFT OUTER JOIN faction f ON f.id = u.displayed_faction WHERE p.x = :x AND p.y = :y AND p.most_recent ORDER BY p.time DESC LIMIT 1")
                    .bind("x", x)
                    .bind("y", y)
                    .map(new DBPixelPlacement.Mapper())
                    .findFirst());
        } catch (NullPointerException e) {
            return Optional.empty();
        }
        return pp;
    }

    /**
     * Gets a pixel by its ID, using the specified handle (or a new one if null).
     * @param handle The handle.
     * @param id The ID.
     * @return The pixel.
     */
    public DBPixelPlacementFull getPixelByID(Handle handle, int id) {
        Optional<DBPixelPlacementFull> pp;
        try {
            if (handle == null)
                pp = jdbi.withHandle(handle2 -> handle2.select("SELECT p.id as p_id, p.x, p.y, p.color, p.who, p.secondary_id, p.time, p.mod_action, p.undo_action, u.id as u_id, u.username, u.login_with_ip, u.ban_expiry, u.is_shadow_banned, u.ban_reason, u.user_agent, u.pixel_count, u.pixel_count_alltime, u.discord_name, f.name as \"faction\" FROM pixels p LEFT JOIN users u ON p.who = u.id LEFT OUTER JOIN faction f ON f.id = u.displayed_faction WHERE p.id = :id")
                        .bind("id", id)
                        .map(new DBPixelPlacementFull.Mapper())
                        .findFirst());
            else
                pp = handle.select("SELECT p.id as p_id, p.x, p.y, p.color, p.who, p.secondary_id, p.time, p.mod_action, p.undo_action, u.id as u_id, u.username, u.login_with_ip, u.ban_expiry, u.is_shadow_banned, u.ban_reason, u.user_agent, u.pixel_count, u.pixel_count_alltime, u.discord_name, f.name as \"faction\" FROM pixels p LEFT JOIN users u ON p.who = u.id LEFT OUTER JOIN faction f ON f.id = u.displayed_faction WHERE p.id = :id")
                        .bind("id", id)
                        .map(new DBPixelPlacementFull.Mapper())
                        .findFirst();
        } catch (NullPointerException e) {
            return null;
        }
        if (!pp.isPresent()) return null;
        if (pp.get().userId == 0) {
            return null;
        }
        return pp.get();
    }

    // returns ids of all pixels that should be rolled back and the DBPixelPlacement for all pixels to rollback to
    // DBRollbackPixel is (DBPixelPlacement and fromID) so it has all the info needed to rollback

    /**
     * Gets pixels to be rolled back to.
     * @param who The user.
     * @param fromSeconds Seconds past now.
     * @return A list of rollback pixels.
     */
    public List<DBRollbackPixel> getRollbackPixels(User who, int fromSeconds) {
        return jdbi.withHandle(handle -> handle.select("SELECT id, secondary_id FROM pixels WHERE most_recent AND who = :who AND (time + :seconds * '1 SECOND'::INTERVAL > NOW())")
                .bind("who", who.getId())
                .bind("seconds", fromSeconds)
                .mapToMap()
                .map(entry -> {
                    DBPixelPlacementFull toPixel;
                    try {
                        int prevId = toIntExact((long) entry.get("secondary_id"));
                        toPixel = getPixelByID(handle, prevId);
                        while (toPixel.banned || toPixel.ban_expiry > Instant.now().toEpochMilli() || toPixel.userId == who.getId() || toPixel.undoAction) {
                            if (toPixel.secondaryId != 0) {
                                toPixel = getPixelByID(handle, toPixel.secondaryId);
                            } else {
                                toPixel = null;
                                break;
                            }
                        }
                    } catch (NullPointerException e) {
                        toPixel = null;
                    }
                    return new DBRollbackPixel(toPixel, toIntExact((long) entry.get("id")));
                })
                .list());
    }

    /**
     * Gets all undo pixels by the specified user.
     * @param who The user.
     * @return A list of undo pixels.
     */
    public List<DBPixelPlacementFull> getUndoPixels(User who) {
        return jdbi.withHandle(handle -> handle.select("SELECT DISTINCT secondary_id FROM pixels WHERE rollback_action AND who = :who AND secondary_id IS NOT NULL")
                .bind("who", who.getId())
                .mapToMap()
                .map(entry -> {
                    int from = toIntExact((long) entry.get("secondary_id"));
                    return handle.select("SELECT p.id as p_id, p.x, p.y, p.color, p.who, p.secondary_id, p.time, p.mod_action, p.undo_action, u.id as u_id, u.username, u.login_with_ip, u.ban_expiry, u.is_shadow_banned, u.ban_reason, u.user_agent, u.pixel_count, u.pixel_count_alltime, u.discord_name FROM pixels p LEFT JOIN users u on p.who = u.id WHERE p.id = :id")
                            .bind("id", from)
                            .map(new DBPixelPlacementFull.Mapper())
                            .first();
                })
                .stream()
                // Filter out places where pixels were placed after the initial rollback.
                .filter(fromPixel -> handle.select("SELECT NOT EXISTS(SELECT 1 FROM pixels WHERE x = :x AND y = :y AND most_recent AND id > :id)")
                    .bind("x", fromPixel.x)
                    .bind("y", fromPixel.y)
                    .bind("id", fromPixel.id)
                    .mapTo(Boolean.class)
                    .first())
                .collect(Collectors.toList()));
    }

    /**
     * Undoes a pixel.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @param color The new color.
     * @param who The user who undid the pixel.
     * @param from The previous pixel ID.
     * @return The inserted row ID.
     */
    public Integer putUndoPixel(int x, int y, int color, User who, int from) {
        int whoID = who == null ? 0 : who.getId();
        int rowID = jdbi.withHandle(handle -> {
            int rowID2 = handle.createUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, rollback_action, most_recent) VALUES (:x, :y, :color, :who, NULL, true, false)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("color", color)
                    .bind("who", whoID)
                    .execute();
            handle.createUpdate("UPDATE pixels SET most_recent = true WHERE id = :from")
                    .bind("from", from)
                    .execute();
            return rowID2;
        });
        return rowID;
    }

    /**
     * Rolls back a pixel.
     * @param who The user who "owns" the rollback pixel.
     * @param from The previous pixel ID.
     * @param to The new color.
     * @return The inserted row ID.
     */
    public Integer putRollbackPixel(User who, int from, int to) {
        int rowID = jdbi.withHandle(handle -> {
           int rowID2 = handle.createUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, rollback_action, most_recent) SELECT x, y, color, :who, :from, true, false FROM pixels AS pp WHERE pp.id = :to ORDER BY id DESC LIMIT 1")
                   .bind("who", who.getId())
                   .bind("from", from)
                   .bind("to", to)
                   .execute();
           handle.createUpdate("UPDATE pixels SET most_recent = true WHERE id = :to")
                   .bind("to", to)
                   .execute();
           handle.createUpdate("UPDATE pixels SET most_recent = false WHERE id = :from")
                   .bind("from", from)
                   .execute();
           return rowID2;
        });
        return rowID;
    }

    /**
     * Rolls back a pixel to its default color.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @param who Who "owns" the rollback pixel.
     * @param from The previous pixel ID.
     * @return The inserted row ID.
     */
    public Integer putRollbackPixelNoPrevious(int x, int y, User who, int from) {
        int rowID = jdbi.withHandle(handle -> {
            handle.createUpdate("INSERT INTO PIXELS (x, y, color, who, secondary_id, rollback_action, most_recent) VALUES (:x, :y, :default_color, :who, :from, true, false)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("default_color", App.getDefaultColor(x, y))
                    .bind("who", who.getId())
                    .bind("from", from)
                    .execute();
            return handle.createUpdate("UPDATE pixels SET most_recent = false WHERE x = :x AND y = :y")
                    .bind("x", x)
                    .bind("y", y)
                    .execute();
        });
        return rowID;
    }

    /**
     * Replaces the pixel at the coordinates with color.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @param color The color to replace with.
     * @return The inserted row ID.
     */
    public Integer putNukePixel(int x, int y, int color) {
        Optional<DBPixelPlacementFull> pp = getFullPixelAt(x, y);
        int rowID = jdbi.withHandle(handle -> {
            handle.createUpdate("UPDATE pixels SET most_recent = false WHERE x = :x AND y = :y")
                    .bind("x", x)
                    .bind("y", y)
                    .execute();
            return handle.createUpdate("INSERT INTO pixels (x, y, color, most_recent) VALUES (:x, :y, :color, :recent)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("color", color)
                    .bind("recent", pp.isEmpty() || pp.get().secondaryId > 0)
                    .execute();
        });
        return rowID;
    }

    /**
     * Replaces the pixel at the coordinates.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @param replace The color to replace.
     * @param color The color to replace with.
     * @return The inserted row ID.
     */
    public Integer putNukePixel(int x, int y, Integer replace, int color) {
        Optional<DBPixelPlacementFull> pp = getFullPixelAt(x, y);
        int rowID = jdbi.withHandle(handle -> {
            handle.createUpdate("UPDATE pixels SET most_recent = false WHERE x = :x AND y = :y AND color = :replace")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("replace", replace)
                    .execute();
            return handle.createUpdate("INSERT INTO pixels (x, y, color, most_recent) VALUES (:x, :y, :color, :recent)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("color", color)
                    .bind("recent", pp.isEmpty() || pp.get().secondaryId > 0)
                    .execute();
        });
        return rowID;
    }

    /**
     * Gets the latest undo pixel from a user.
     * @param who The user.
     * @return The latest undo pixel.
     */
    public DBPixelPlacementFull getUserUndoPixel(User who) {
        return jdbi.withHandle(handle -> handle.select("SELECT p.id as p_id, p.x, p.y, p.color, p.who, p.secondary_id, p.time, p.mod_action, p.rollback_action, p.undone, p.undo_action, p.most_recent, u.id as u_id, u.stacked, u.username, u.signup_time, u.cooldown_expiry, u.ban_expiry, u.is_shadow_banned, u.login_with_ip, u.signup_ip, u.last_ip, u.last_ip_alert, u.perma_chat_banned, u.chat_ban_expiry, u.chat_ban_reason, u.ban_reason, u.user_agent, u.pixel_count, u.pixel_count_alltime, u.is_rename_requested, u.discord_name, u.chat_name_color FROM pixels p LEFT JOIN users u ON p.who = u.id WHERE p.who = :who AND NOT p.rollback_action ORDER BY p.id DESC LIMIT 1")
                .bind("who", who.getId())
                .map(new DBPixelPlacementFull.Mapper())
                .first());
    }

    /**
     * Puts an undo pixel with the specified {@link DBPixelPlacementFull} data.
     * @param backPixel The previous pixel's data.
     * @param who Who undid the pixel.
     * @param from The undone pixel ID.
     */
    public void putUserUndoPixel(DBPixelPlacementFull backPixel, User who, int from) {
        int whoID = who == null ? 0 : who.getId();
        jdbi.useHandle(handle -> {
            handle.createUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, undo_action, most_recent) VALUES (:x, :y, :color, :who, NULL, true, false)")
                    .bind("x", backPixel.x)
                    .bind("y", backPixel.y)
                    .bind("color", backPixel.color)
                    .bind("who", whoID)
                    .execute();
            handle.createUpdate("UPDATE pixels SET most_recent = true, undone = false WHERE id = :back_id")
                    .bind("back_id", backPixel.id)
                    .execute();
            handle.createUpdate("UPDATE pixels SET most_recent = false, undone = true WHERE id = :from")
                    .bind("from", from)
                    .execute();
        });
    }

    /**
     * Puts an undo pixel at the specified coordinates.
     * @param x The pixel's x-coordinates.
     * @param y The pixel's y-coordinates.
     * @param color The pixel's color.
     * @param who Who undid the pixel.
     * @param from The undone pixel ID.
     */
    public void putUserUndoPixel(int x, int y, int color, User who, int from) {
        int whoID = who == null ? 0 : who.getId();
        jdbi.useHandle(handle -> {
            handle.createUpdate("INSERT INTO pixels (x, y, color, who, secondary_id, undo_action, most_recent) VALUES (:x, :y, :color, :who, NULL, true, false)")
                    .bind("x", x)
                    .bind("y", y)
                    .bind("color", color)
                    .bind("who", whoID)
                    .execute();
            handle.createUpdate("UPDATE pixels SET most_recent = true, undone = false WHERE id = :back_id")
                    .bind("back_id", 0)
                    .execute();
            handle.createUpdate("UPDATE pixels SET most_recent = false, undone = true WHERE id = :from")
                    .bind("from", from)
                    .execute();
        });
    }

    /**
     * Gets a user by their login.
     * @param method The user's login method.
     * @param serviceUserID The user's ID on the login service.
     * @return The user.
     */
    public Optional<DBUser> getUserByLogin(String service, String serviceUserID) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM users WHERE id = (SELECT uid FROM user_logins WHERE service = :service AND service_uid = :service_uid)")
                .bind("service", service)
                .bind("service_uid", serviceUserID)
                .map(new DBUser.Mapper())
                .findFirst());
    }

    /**
     * Gets an user that logs in by their signup IP.
     * @param signupIP The user's IP on signup.
     * @return The user.
     */
    public Optional<DBUser> getSnipUserByIP(String signupIP) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM users WHERE login_with_ip = true AND signup_ip = :signup_ip::INET")
                .bind("signup_ip", signupIP)
                .map(new DBUser.Mapper())
                .findFirst());
    }

    /**
     * Gets a user by their username.
     * @param name The user's username.
     * @return The user.
     */
    public Optional<DBUser> getUserByName(String name) {
        return jdbi.withHandle(handle -> handle.select(SQL_USER_BY_NAME)
                .bind("username", name)
                .map(new DBUser.Mapper())
                .findFirst());
    }

    /**
     * Gets a user by their ID.
     * @param who The user's ID.
     * @return The user.
     */
    public Optional<DBUser> getUserByID(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT id, stacked, username, signup_time, cooldown_expiry, ban_expiry, is_shadow_banned, login_with_ip, signup_ip, last_ip, last_ip_alert, perma_chat_banned, chat_ban_expiry, chat_ban_reason, ban_reason, user_agent, pixel_count, pixel_count_alltime, is_rename_requested, discord_name, chat_name_color, displayed_faction, faction_restricted FROM users WHERE id = :who")
                .bind("who", who)
                .map(new DBUser.Mapper())
                .findFirst());
    }

    /**
     * Gets a user by their token.
     * @param token The user's token.
     * @return The user.
     */
    public Optional<DBUser> getUserByToken(String token) {
        return jdbi.withHandle(handle -> handle.select("SELECT u.id, u.stacked, u.username, u.signup_time, u.cooldown_expiry, u.ban_expiry, u.is_shadow_banned, u.login_with_ip, u.signup_ip, u.last_ip, u.last_ip_alert, u.perma_chat_banned, u.chat_ban_expiry, u.chat_ban_reason, u.ban_reason, u.user_agent, u.pixel_count, u.pixel_count_alltime, u.is_rename_requested, u.discord_name, u.chat_name_color, u.displayed_faction, u.faction_restricted FROM users u INNER JOIN sessions s ON u.id = s.who WHERE s.token = :token")
                .bind("token", token)
                .map(new DBUser.Mapper())
                .findFirst());
    }

    /**
     * Creates a new user entry.
     * @param name The username.
     * @param login The login method.
     * @param ip The IP address.
     * @return The user.
     */
    public DBUser createUser(String name, UserLogin login, String ip) {
        // TODO(netux): use jdbi.inTransaction
        return jdbi.withHandle(handle -> {
            DBUser user = handle.createQuery("INSERT INTO users (username, login_with_ip, signup_ip, last_ip, chat_name_color) VALUES (:username, :login_with_ip, :ip::INET, :ip::INET, :chat_name_color) RETURNING *")
                .bind("username", name)
                .bind("ip", ip)
                .bind("login_with_ip", App.getConfig().getBoolean("oauth.useIp"))
                .bind("chat_name_color", App.getConfig().getInt("chat.defaultColorIndex"))
                .map(new DBUser.Mapper())
                .findFirst()
                .orElse(null);
            if (user != null) {
                addUserLogin(handle, user.id, login);
            }
            return user;
        });
    }

    /**
     * Gets a list of all user logins
     * @param who The user's ID.
     */
    public List<DBUserLogin> getUserLogins(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT service, service_uid FROM user_logins WHERE uid = :uid")
                .bind("uid", who)
                .map(new DBUserLogin.Mapper())
                .list());
    }

    /**
     * Gets the user login for a service
     * @param who The user's ID.
     * @param service The service the login belongs to.
     */
    public Optional<DBUserLogin> getUserLoginForService(int who, String service) {
        return jdbi.withHandle(handle -> handle.select("SELECT service, service_uid FROM user_logins WHERE uid = :uid AND service = :service")
                .bind("uid", who)
                .bind("service", who)
                .map(new DBUserLogin.Mapper())
                .findFirst());
    }

    private int bulkAddUserLogins(Handle handle, int userID, List<UserLogin> logins) {
        var batch = handle.prepareBatch("INSERT INTO user_logins (uid, service, service_uid) VALUES (:uid, :service, :service_uid)");
        for (UserLogin login : logins) {
            batch.bind("uid", userID)
                .bind("service", login.getServiceID())
                .bind("service_uid", login.getServiceUserID())
                .add();
        }
        return Arrays.stream(batch.execute()).reduce(0, (left, right) -> left + right);
    }

    /**
     * Adds a list of login methods to the user.
     * @param userID The user's ID.
     * @param login The new {@link UserLogin}s.
     * @return The amount of logins added.
     */
    public int bulkAddUserLogins(int userID, List<UserLogin> logins) {
        return jdbi.withHandle(handle -> bulkAddUserLogins(handle, userID, logins));
    }

    private boolean addUserLogin(Handle handle, int userID, UserLogin login) {
        return bulkAddUserLogins(handle, userID, List.of(login)) != 0;
    }

    /**
     * Add a single login method to the user.
     * @param userID The user's ID.
     * @param login The new {@link UserLogin}.
     * @return Whenever or not the login method was added.
     */
    public boolean addUserLogin(int userID, UserLogin login) {
        return jdbi.withHandle(handle -> addUserLogin(handle, userID, login));
    }

    private int bulkRemoveUserLoginServices(Handle handle, int userID, List<String> loginServiceIDs) {
        var batch = handle.prepareBatch("DELETE FROM user_logins WHERE uid = :uid AND service = :service");
        for (String serviceID : loginServiceIDs) {
            batch.bind("uid", userID)
                .bind("service", serviceID)
                .add();
        }
        return Arrays.stream(batch.execute())
            .reduce(0, (left, right) -> left + right);
    }

    /**
     * Removes a list of login methods of the user.
     * @param userID The user's ID.
     * @param loginServiceIDs The services to remove the login of.
     * @return The amount of logins removed.
     */
    public int bulkRemoveUserLoginServices(int userID, List<String> loginServiceIDs) {
        return jdbi.withHandle(handle -> bulkRemoveUserLoginServices(handle, userID, loginServiceIDs));
    }

    private boolean removeUserLoginService(Handle handle, int userID, String loginServiceID) {
        return bulkRemoveUserLoginServices(handle, userID, List.of(loginServiceID)) != 0;
    }

    /**
     * Removes a single login method of the user.
     * @param userID The user's ID.
     * @param loginServiceIDs The services to remove the login of.
     * @return Whenever or not the user had the login method.
     */
    public boolean removeUserLoginService(int userID, String loginServiceID) {
        return jdbi.withHandle(handle -> removeUserLoginService(handle, userID, loginServiceID));
    }

    private Integer removeAllUserLogins(Handle handle, int userID) {
        return handle.createUpdate("DELETE FROM user_logins WHERE uid = :uid")
                    .bind("uid", userID)
                    .execute();
    }

    /**
     * Removes all of the user's login methods.
     * @param userID The user's ID.
     */
    public Integer removeAllUserLogins(int userID) {
        return jdbi.withHandle(handle -> removeAllUserLogins(handle, userID));
    }

    /**
     * Updates the user's login methods.
     *
     * @param userID The user's ID.
     * @param logins The new {@link UserLogin}s.
     * @return The amount of logins the user has after the action.
     */
    public Integer setUserLogins(int userID, List<UserLogin> logins) {
        return jdbi.inTransaction(handle -> {
            removeAllUserLogins(handle, userID);
            return bulkAddUserLogins(handle, userID, logins);
        });
    }

    static class UserkeyMapper implements RowMapper<Map.Entry<String, String>> {
        @Override
        public Map.Entry<String, String> map(ResultSet rs, StatementContext ctx) throws SQLException {
            return new SimpleEntry<String, String>(rs.getString("canvas_code"), rs.getString("key"));
        }
    }

    /**
     * @param userID The user's ID.
     */
    public Map<String, String> getUserKeys(int userID) {
        return jdbi.withHandle(handle ->
            handle.select("SELECT key, canvas_code FROM user_keys WHERE uid = :uid")
                .bind("uid", userID)
                .map(new UserkeyMapper())
                .list()
        )
        .stream()
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /**
     * @param who The user's ID.
     * @param token The user's token.
     */
    public void createSession(int who, String token) {
        jdbi.useHandle(handle -> handle.createUpdate("INSERT INTO sessions (who, token) VALUES (:who, :token)")
                .bind("who", who)
                .bind("token", token)
                .execute());
    }

    /**
     * Destroys the user's session.
     * @param token The user's token.
     */
    public void destroySession(String token) {
        jdbi.useHandle(handle -> handle.createUpdate("DELETE FROM sessions WHERE token = :token")
                .bind("token", token)
                .execute());
    }

    /**
     * Resets the user's session timeout.
     * @param token The user's token.
     */
    public void updateSession(String token) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE sessions SET time = CURRENT_TIMESTAMP WHERE token = :token")
                .bind("token", token)
                .execute());
    }

    /**
     * @param who The user ID.
     * @return The user's roles.
     */
    public List<Role> getUserRoles(int who) {
        return jdbi.withHandle(handle ->
                handle.createQuery("SELECT role FROM roles WHERE id = :who")
                        .bind("who", who)
                        .map(new Role.Mapper())
                        .withStream(stream -> stream
                            .filter(role -> role != null)
                            .collect(Collectors.toList())
                        )
        );
    }

    /**
     * Updates the {@link User}'s roles.
     * @param userID The user's ID.
     * @param roles The new roles.
     */
    public void setUserRoles(int userID, List<Role> roles) {
        jdbi.useHandle(handle -> handle.createUpdate("DELETE FROM roles WHERE id = :who")
                .bind("who", userID)
                .execute());
        jdbi.useTransaction(handle -> {
            for (Role role : roles) {
                handle.createUpdate("INSERT INTO roles VALUES (:who, :role)")
                        .bind("who", userID)
                        .bind("role", role.getID())
                        .execute();
            }
        });
    }

    /**
     * Updates the {@link User}'s ban length.
     * @param user The user.
     * @param time The new time length from now, in seconds.
     */
    public void updateBan(User user, Integer time) {
        jdbi.useHandle(handle -> {
            String expiryStr = "NOW() + :expiry * '1 SECOND'::INTERVAL";
            if (time == null) {
                expiryStr = "NULL";
            } else if (time == 0) {
                expiryStr = "TO_TIMESTAMP(0)";
            }
            handle.createUpdate("UPDATE users SET ban_expiry = " + expiryStr + " WHERE id = :who")
                    .bind("who", user.getId())
                    .bind("expiry", time)
                    .execute();
        });
    }

    /**
     * Updates the {@link User}'s ban reason.
     * @param user The user.
     * @param reason The new ban reason.
     */
    public void updateBanReason(User user, String reason) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET ban_reason = :ban_reason WHERE id = :who")
                .bind("who", user.getId())
                .bind("ban_reason", reason)
                .execute());
    }

    /**
     * Updates the {@link User}'s shadow-ban status.
     * @param user The user.
     * @param shadowBanned Whether or not the user is shadow-banned.
     */
    public void updateUserShadowBanned(User user, boolean shadowBanned) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET is_shadow_banned = :shadow_banned WHERE id = :who")
                .bind("who", user.getId())
                .bind("shadow_banned", shadowBanned)
                .execute());
    }

    /**
     * Updates the {@link User}'s user agent.
     * @param user The user.
     * @param agent The new user agent.
     */
    public void updateUserAgent(User user, String agent) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET user_agent = :user_agent WHERE id = :who")
                .bind("who", user.getId())
                .bind("user_agent", agent)
                .execute());
    }

    /**
     * Updates the {@link User}'s last IP.
     * @param user The user.
     * @param ip The new last IP.
     */
    public void updateUserIP(User user, String ip) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET last_ip = :ip::INET WHERE id = :who")
                .bind("who", user.getId())
                .bind("ip", ip)
                .execute());
    }

    /**
     * Sets the {@link User}'s stack count.
     * @param user The user.
     * @param stacked The new stack count.
     */
    public void updateUserStacked(User user, int stacked) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET stacked = :stacked WHERE id = :who")
                .bind("who", user.getId())
                .bind("stacked", stacked)
                .execute());
    }

    /**
     * Gets whether or not the {@link User} has been requested to change their username.
     * @param who The {@link User}'s ID.
     * @return Whether or not the user has been requested to change their username.
     */
    public boolean isRenameRequested(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT is_rename_requested FROM users WHERE id = :who")
                .bind("who", who)
                .mapTo(Boolean.class)
                .first());
    }

    /**
     * Sets whether or not the {@link User} has been requested to change their username.
     * @param who The ID of the user to update.
     * @param isRequested Whether or not the user has been requested to change their username.
     */
    public void setRenameRequested(int who, boolean isRequested) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET is_rename_requested = :is_requested WHERE id = :who")
                .bind("who", who)
                .bind("is_requested", isRequested)
                .execute());
    }

    /**
     * Updates the requested {@link User}'s username. <strong>Does not do any collision checks</strong>.
     * @param who The {@link User}'s ID.
     * @param username The new username.
     */
    public void updateUsername(int who, String username) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET username = :username WHERE id = :who")
                .bind("who", who)
                .bind("username", username)
                .execute());
    }

    /**
     * Sets the public Discord username of the {@link User}.
     * @param who The {@link User}'s ID.
     * @param discordName The new discord username.
     */
    public void setDiscordName(int who, String discordName) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET discord_name = :name WHERE id = :who")
                .bind("who", who)
                .bind("name", discordName)
                .execute());
    }

    /**
     * Sets the {@link User}'s faction_restricted state, which disallows them from creating or obtaining ownership of factions.
     * <br>This will not remove their currently owned factions, only disallow future actions.
     *
     * @param who The {@link User}'s ID.
     * @param factionBlocked Whether or not the user is currently faction_restricted.
     */
    public void setUserFactionBlocked(int who, boolean factionBlocked) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET faction_restricted = :blocked WHERE id = :who")
            .bind("who", who)
            .bind("blocked", factionBlocked)
            .execute());
    }

    /**
     * Gets the {@link User}'s ban reason.
     * @param who The {@link User}'s ID.
     * @return The {@link User}'s ban reason.
     */
    public String getUserBanReason(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT ban_reason FROM users WHERE id = :who")
                .bind("who", who)
                .mapTo(String.class)
                .first());
    }

    /**
     * Gets the amount of pixels a {@link User} has for the current canvas.
     * @param who The {@link User}'s ID.
     * @return The amount of pixels the user has.
     */
    public int getUserPixelCount(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT pixel_count FROM users WHERE id = :who")
                .bind("who", who)
                .mapTo(Integer.class)
                .first());
    }

    /**
     * Gets the amount of all-time pixels a {@link User} has.
     * @param who The {@link User}'s ID.
     * @return The amount of all-time pixels the user has.
     */
    public int getUserPixelCountAllTime(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT pixel_count_alltime FROM users WHERE id = :who")
                .bind("who", who)
                .mapTo(Integer.class)
                .first());
    }

    /**
     * Invalidates sessions older than 24 days.
     */
    public void clearOldSessions() {
        jdbi.useHandle(handle -> handle.createUpdate("DELETE FROM sessions WHERE (time + '24 DAYS'::INTERVAL) < NOW()")
                .execute());
    }

    /**
     * Gets whether or not the pixel at the specified pixel has been changed.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @return The pixel's changed status.
     */
    public boolean didPixelChange(int x, int y) {
        return jdbi.withHandle(handle -> handle.select("SELECT EXISTS(SELECT 1 FROM pixels WHERE x = :x AND y = :y AND most_recent)")
                .bind("x", x)
                .bind("y", y)
                .mapTo(Boolean.class)
                .first());
    }

    /**
     * Gets whether or not the pixel cooldown timer should increase for the specified pixel.
     * @param who The {@link User}'s ID.
     * @param x The pixel's x-coordinate.
     * @param y The pixel's y-coordinate.
     * @return Whether the cooldown timer should increase.
     */
    public boolean shouldPixelTimeIncrease(int who, int x, int y) {
        return App.getConfig().getBoolean("selfPixelTimeIncrease") ? didPixelChange(x, y) : jdbi.withHandle(handle -> handle.select("SELECT EXISTS(SELECT 1 FROM pixels WHERE x = :x AND y = :y AND who <> :who AND most_recent)")
                .bind("who", who)
                .bind("x", x)
                .bind("y", y)
                .mapTo(Boolean.class)
                .first());
    }

    /**
     * Gets whether or not the specified {@link User} is flagged to trigger a last IP alert.
     * @param who The {@link User}'s ID.
     * @return Whether or not the {@link User} is flagged.
     */
    public boolean hasLastIPAlertFlag(int who) {
        return jdbi.withHandle(handle -> handle.select("SELECT last_ip_alert FROM users WHERE id = :who")
                .bind("who", who)
                .mapTo(Boolean.class)
                .first());
    }

    /**
     * Sets whether or not the specified {@link User} is flagged to trigger a last IP alert.
     * @param who The {@link User}'s ID.
     * @param isFlagged Whether or not the {@link User} is flagged.
     */
    public void setLastIPAlertFlag(int who, boolean isFlagged) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET last_ip_alert = :flagged WHERE id = :who")
                .bind("flagged", isFlagged)
                .bind("who", who)
                .execute());
    }

    /**
     * Inserts an admin log from the specified {@link User}.
     * @param who The {@link User}'s ID.
     * @param message The log message.
     * @return The inserted row ID.
     */
    public Integer insertAdminLog(int who, String message) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO admin_log (channel, level, message, time, userid) VALUES ('pxlsCanvas', 200, :message, (SELECT EXTRACT(EPOCH FROM NOW())), :who)")
                .bind("who", who)
                .bind("message", message)
                .execute());
    }

    /**
     * Inserts an admin log from the server.
     * @param message The log message.
     * @return The inserted row ID.
     */
    public Integer insertServerAdminLog(String message) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO admin_log (channel, level, message, time, userid) VALUES ('pxlsConsole', 200, :message, (SELECT EXTRACT(EPOCH FROM NOW())), NULL)")
                .bind("message", message)
                .execute());
    }

    /**
     * @param reporter The reporting {@link User}' ID.
     * @param reported The reported {@link User}'s ID.
     * @param pixel The pixel ID.
     * @param x The pixel's X-coordinate.
     * @param y The pixel's Y-coordinate.
     * @param message The report message.
     * @return The inserted row ID.
     */
    public Integer insertReport(int reporter, int reported, int pixel, int x, int y, String message) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO reports (who, reported, pixel_id, x, y, message, time) VALUES (:reporter, :reported, :pixel, :x, :y, :message, (SELECT EXTRACT(EPOCH FROM NOW())))")
                .bind("reporter", reporter)
                .bind("reported", reported)
                .bind("pixel", pixel)
                .bind("x", x)
                .bind("y", y)
                .bind("message", message)
                .executeAndReturnGeneratedKeys("id")
                .mapTo(Integer.TYPE)
                .first());
    }

    public List<DBChatReport> getChatReportsFromUser(int uid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM chat_reports WHERE initiator = :uid ORDER BY time DESC")
                .bind("uid", uid)
                .map(new DBChatReport.Mapper())
                .list()
        );
    }

    public List<DBCanvasReport> getCanvasReportsFromUser(int uid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM reports WHERE who = :uid ORDER BY time DESC")
                .bind("uid", uid)
                .map(new DBCanvasReport.Mapper())
                .list()
        );
    }

    /**
     * Inserts a server report.
     * @param reported The banned {@link User}'s ID.
     * @param message The report message.
     */
    public Integer insertServerReport(int reported, String message) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO reports (who, pixel_id, x, y, message, reported, time) VALUES (0, 0, 0, 0, :message, :reported, (SELECT EXTRACT(EPOCH FROM NOW())))")
                .bind("message", message)
                .bind("reported", reported)
                .executeAndReturnGeneratedKeys("id")
                .mapTo(Integer.TYPE)
                .first());
    }

    /**
     * @param who The {@link User}'s ID.
     * @param ip The {@link User}'s IP.
     * @return Whether or not the specified {@link User} has other {@link User}s with the same sign-up IP or last IP.
     */
    public boolean haveDuplicateIP(int who, String ip) {
        return jdbi.withHandle(handle -> handle.select("SELECT EXISTS(SELECT 1 FROM users WHERE (last_ip = :ip::INET OR signup_ip = :ip::INET) AND id <> :who )")
                .bind("ip", ip)
                .bind("who", who)
                .mapTo(Boolean.class)
                .first());
    }

    /**
     * Gets the count of {@link User}s who have the same sign-up or last IP as the specified {@link User}.
     * @param who The {@link User}'s ID.
     * @param ip The {@link User}'s IP.
     * @return The count of found {@link User} IDs.
     */
    public int getDuplicateCount(int who, String ip) {
        return jdbi.withHandle(handle -> handle.select("SELECT count(id) FROM users WHERE (last_ip = :ip::INET or signup_ip = :ip::INET) AND id <> :who")
                .bind("ip", ip)
                .bind("who", who)
                .mapTo(Integer.class)
                .first());
    }

    /**
     * Gets a list of {@link User} IDs who have the same sign-up IP or last IP as the specified {@link User}.
     * @param who The {@link User}'s ID.
     * @param ip The {@link User}'s IP.
     * @return A list of the found {@link User} IDs.
     */
    public List<Integer> getDuplicateUsers(int who, String ip) {
        return jdbi.withHandle(handle -> handle.select("SELECT id FROM users WHERE (last_ip = :ip::INET OR signup_ip = :ip::INET) AND id <> :who")
                .bind("ip", ip)
                .bind("who", who)
                .mapTo(Integer.class)
                .list());
    }

    /**
     * @param who The {@link User}'s ID.
     * @param ip The {@link User}'s IP.
     * @param pixel The {@link DBPixelPlacement} given to the user by the lookup.
     * @return The inserted row ID.
     */
    public Integer insertLookup(Integer who, String ip, Integer pixel) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO lookups (who, ip, pixel) VALUES (:who, :ip::INET, :pixel)")
                .bind("who", who)
                .bind("ip", ip)
                .bind("pixel", pixel)
                .execute());
    }

    /**
     * Sets the chat name color for the specified {@link User}.
     * @param who The {@link User}'s ID.
     * @param color The palette color.
     */
    public void setChatNameColor(int who, int color) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET chat_name_color = :color WHERE id = :who")
                .bind("who", who)
                .bind("color", color)
                .execute());
    }

    /**
     * @param initiatorID The initiator's {@link User} ID.
     * @param bannedID The banned {@link User}'s ID.
     * @param when The ban creation date.
     * @param expiry The ban expiry date.
     * @param action The ban action.
     * @param reason The ban reason.
     * @return The inserted row ID.
     */
    public Integer insertBanLog(Integer initiatorID, int bannedID, long when, Long expiry, String action, String reason) {
        if (expiry == null) expiry = 0L;
        when /= 1000L;
        expiry /= 1000L;
        long finalWhen = when;
        Long finalExpiry = expiry;
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO banlogs (\"when\", banner, banned, ban_expiry, action, ban_reason) VALUES (:when, :banner, :banned, :expiry, :action, :reason)")
                .bind("when", finalWhen)
                .bind("banner", initiatorID)
                .bind("banned", bannedID)
                .bind("expiry", finalExpiry)
                .bind("action", action)
                .bind("reason", reason)
                .execute());
    }

    /* CHAT */

    /**
     * @param authorID The author's {@link User} ID.
     * @param sent The chat message's creation epoch.
     * @param content The chat contents.
     * @param filtered The filtered chat contents.
     * @param shadowBanned Whether or not the user sending the message is shadow-banned.
     * @return The new chat message's ID.
     */
    public Integer createChatMessage(int authorID, long sent, String content, String filtered, int replyingToId, boolean replyShouldMention, boolean shadowBanned) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO chat_messages (author, sent, content, filtered, replying_to_id, reply_should_mention, shadow_banned) VALUES (:author, :sent, :content, :filtered, :replying_to_id, :reply_should_mention, :shadow_banned)")
                .bind("author", authorID)
                .bind("sent", sent)
                .bind("content", content)
                .bind("filtered", filtered)
                .bind("replying_to_id", replyingToId)
                .bind("reply_should_mention", replyShouldMention)
                .bind("shadow_banned", shadowBanned)
                .executeAndReturnGeneratedKeys("id")
                    .mapTo(Integer.TYPE)
                    .first());
    }

    /**
     * @param author The author {@link User}.
     * @param sent The chat message's creation epoch.
     * @param content The chat contents.
     * @param filtered The filtered chat contents.
     * @return The new chat message's ID.
     */
    public Integer createChatMessage(User author, long sent, String content, String filtered, int replyingToId, boolean replyShouldMention) {
        return createChatMessage(author == null ? -1 : author.getId(), sent / 1000L, content, filtered, replyingToId, replyShouldMention, author != null && author.isShadowBanned());
    }

    /**
     * Retrieves the {@link DBChatMessage} associated with the given <pre>id</pre>.
     * @param id The {@link DBChatMessage} id to fetch with.
     * @return The retrieved {@link DBChatMessage}.
     */
    public DBChatMessage getChatMessageByID(int id) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM chat_messages WHERE id = :id LIMIT 1")
                .bind("id", id)
                .map(new DBChatMessage.Mapper())
                .first());
    }

    /**
     * Retrieves all {@link DBChatMessage}s by the specified author, sorted by date sent descending.
     * @param authorID The author's {@link User} ID.
     * @return The retrieved {@link DBChatMessage}s.
     */
    public List<DBChatMessage> getChatMessagesByAuthor(int authorID) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM chat_messages WHERE author = :author ORDER BY sent ASC")
                .bind("author", authorID)
                .map(new DBChatMessage.Mapper())
                .list());
    }

    public List<DBChatMessage> getLastXMessagesFromUID(int authorID, int limit) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM chat_messages WHERE author = :uid ORDER BY sent DESC LIMIT :limit")
            .bind("uid", authorID)
            .bind("limit", limit)
            .map(new DBChatMessage.Mapper())
            .list());
    }

    /**
     * Retrieves the last <pre>x</pre> amount of {@link DBChatMessage}s.
     * @param x The amount of chat messages to retrieve.
     * @param includePurged Whether or not to include purged messages.
     * @return The retrieved {@link DBChatMessage}s. The length is determined by the {@link ResultSet} size.
     */
    public List<DBChatMessage> getLastXMessages(int x, boolean includePurged) {
        return jdbi.withHandle(handle -> handle.select("SELECT * FROM chat_messages cm WHERE CASE WHEN :includePurged THEN true ELSE purged = false END ORDER BY sent DESC LIMIT :limit")
                .bind("includePurged", includePurged)
                .bind("limit", x)
                .map(new DBChatMessage.Mapper())
                .list());
    }

    /**
     * Updates the permanent chat ban status for the specified {@link User} by their ID.
     * @param toUpdateID The {@link User}'s ID.
     * @param isPermaChatBanned Whether or not the {@link User} is permanently chat banned.
     */
    public void updateChatBanPerma(int toUpdateID, boolean isPermaChatBanned) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET perma_chat_banned = :banned WHERE id = :id")
                .bind("banned", isPermaChatBanned)
                .bind("id", toUpdateID)
                .execute());
    }

    /**
     * Updates the permanent chat ban status for the specified {@link User}.
     * @param toUpdate The {@link User}.
     * @param isPermaChatBanned Whether or not the {@link User} is permanently chat banned.
     */
    public void updateChatBanPerma(User toUpdate, boolean isPermaChatBanned) {
        if (toUpdate == null) throw new IllegalArgumentException("Cannot update a non-existent user's chat ban");
        updateChatBanPerma(toUpdate.getId(), isPermaChatBanned);
    }

    /**
     * Updates the chat ban expiry for the specified {@link User} by their ID.
     * @param targetID The {@link User}'s ID.
     * @param expiry The new chat ban expiry epoch.
     */
    public void updateChatBanExpiry(int targetID, long expiry) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET chat_ban_expiry = :expiry WHERE id = :id")
                .bind("expiry", new Timestamp(expiry))
                .bind("id", targetID)
                .execute());
    }

    /**
     * Updates the chat ban expiry for the specified {@link User}.
     * @param target The target {@link User}.
     * @param expiry The new chat ban expiry epoch.
     */
    public void updateChatBanExpiry(User target, long expiry) {
        updateChatBanExpiry(target.getId(), expiry);
    }

    /**
     * @param cmid The {@link ChatMessage}'s id.
     * @param targetID The reported {@link User}'s ID.
     * @param initiatorID The initiating {@link User}'s ID.
     * @param reportMessage The body of the report.
     * @return The inserted row ID.
     */
    public Integer insertChatReport(int cmid, int targetID, int initiatorID, String reportMessage) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO chat_reports (cmid, target, initiator, report_message, time) VALUES (:cmid, :target, :initiator, :report_message, (SELECT EXTRACT(EPOCH FROM NOW())))")
                .bind("cmid", cmid)
                .bind("target", targetID)
                .bind("initiator", initiatorID)
                .bind("report_message", reportMessage)
                .executeAndReturnGeneratedKeys("id")
                    .mapTo(Integer.TYPE)
                    .first());
    }

    /**
     * @param cmid The {@link ChatMessage}'s id.
     * @param target The reported {@link User}.
     * @param initiator The initiating {@link User}.
     * @param reportMessage The body of the report.
     * @return The inserted row ID.
     */
    public Integer insertChatReport(int cmid, User target, User initiator, String reportMessage) {
        return insertChatReport(cmid, target.getId(), initiator == null ? 0 : initiator.getId(), reportMessage);
    }

    /**
     * Purges an amount of chat messages sent by the specified {@link User}, for the specified reason.
     * @param target The {@link User} to purge messages from.
     * @param initiator The {@link User} who purged chat messages.
     * @param amount The amount of chat messages to purge.
     * @param reason The reason for the purge.
     * @param broadcast Whether or not to broadcast a purge message.
     */
    public void purgeChat(User target, User initiator, int amount, String reason, boolean broadcast, boolean announce) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE chat_messages SET purged = true, purged_by = :initiator, purge_reason = :reason WHERE author = :who")
                .bind("initiator", initiator == null ? 0 : initiator.getId())
                .bind("who", target.getId())
                .bind("reason", reason)
                .execute());
        String initiatorName = initiator == null ? "CONSOLE" : initiator.getName();
        int initiatorID = initiator == null ? 0 : initiator.getId();
        String logReason = reason != null && reason.length() > 0 ? " with reason: " + reason : "";
        String logMessage = String.format("<%s, %s> purged %s messages from <%s, %s>%s.", initiatorName, initiatorID, amount, target.getName(), target.getId(), logReason);
        if (initiator == null) {
            insertServerAdminLog(logMessage);
        } else {
            insertAdminLog(initiatorID, logMessage);
        }
        if (broadcast) {
            App.getServer().getPacketHandler().sendChatPurge(target, initiator, amount, reason, announce);
        }
    }

    /**
     * Purges an specific chat message, for the specified reason.
     * @param target The {@link User} to purge messages from, for logging purposes.
     * @param initiator The {@link User} who purged chat messages.
     * @param id The id of the chat message to purge.
     * @param reason The reason for the purge.
     * @param broadcast Whether or not to broadcast a purge message.
     */
    public void purgeChatID(User target, User initiator, Integer id, String reason, boolean broadcast, boolean announce) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE chat_messages SET purged = true, purged_by = :initiator, purge_reason = :reason WHERE id = :id")
                .bind("initiator", initiator.getId())
                .bind("id", id)
                .bind("reason", reason)
                .execute());
        String initiatorName = initiator == null ? "CONSOLE" : initiator.getName();
        int initiatorID = initiator == null ? 0 : initiator.getId();
        String logReason = reason != null && reason.length() > 0 ? " with reason: " + reason : "";
        String logMessage = String.format("<%s, %s> purged message with id %d from <%s, %s>%s.", initiatorName, initiatorID, id, target.getName(), target.getId(), logReason);
        if (initiator == null) {
            insertServerAdminLog(logMessage);
        } else {
            insertAdminLog(initiatorID, logMessage);
        }
        if (broadcast) {
            App.getServer().getPacketHandler().sendSpecificPurge(target, initiator, id, reason, announce);
        }
    }

    /**
     * Gets the {@link User}'s chat ban reason.
     * @param id The {@link User}'s ID.
     * @return The chat ban reason.
     */
    public String getChatBanReason(int id) {
        return jdbi.withHandle(handle -> handle.select("SELECT chat_ban_reason FROM users WHERE id = :id")
                .bind("id", id)
                .mapTo(String.class)
                .first());
    }

    /**
     * Updates the {@link User}'s chat ban reason.
     * @param id The {@link User}'s ID.
     * @param reason The new chat ban reason.
     */
    public void updateChatBanReason(int id, String reason) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE users SET chat_ban_reason = :reason WHERE id = :id")
                .bind("reason", reason)
                .bind("id", id)
                .execute());
    }

    /**
     * Returns the requested user's last 100 messages and chatbans.
     *
     * @param username The {@link User}'s name to look up.
     * @param history_limit The maximum number of chat message history to fetch.
     * @return The requested user's last 100 messages and chatbans.
     */
    public ServerChatLookup runChatLookupForUsername(String username, int history_limit) {
        // we want to run all these queries with their own handle so we don't hit the pool x times.
        return jdbi.withHandle(handle -> {
            Optional<DBUser> dbu = handle.createQuery(SQL_USER_BY_NAME)
                    .bind("username", username)
                    .map(new DBUser.Mapper())
                    .findFirst();
            if (!dbu.isPresent()) return null;
            DBUser dbUser = dbu.get();

            List<DBExtendedChatban> chatbans = handle.createQuery("SELECT cb.*,u.username AS target_name,u1.username AS initiator_name FROM chatbans cb INNER JOIN users u ON u.id = cb.target INNER JOIN users u1 ON u1.id = cb.initiator WHERE cb.target = :uid ORDER BY \"when\" DESC;")
                    .bind("uid", dbUser.id)
                    .map(new DBExtendedChatban.Mapper())
                    .list();

            List<DBChatMessage> messages = handle.createQuery("SELECT * FROM chat_messages WHERE author = :uid ORDER BY sent DESC LIMIT :lim")
                    .bind("uid", dbUser.id)
                    .bind("lim", history_limit)
                    .map(new DBChatMessage.Mapper())
                    .list();

            return new ServerChatLookup(dbUser, messages, chatbans);
        });
    }

    /* END CHAT */

    /* NOTIFICATIONS */

    /**
     * Gets a list of notifications, including or excluding expired ones.
     * @param expired Whether to include expired notifications.
     * @return A list of notifications.
     */
    public List<DBNotification> getNotifications(boolean expired) {
        return jdbi.withHandle(handle -> handle.select("SELECT n.id, n.time, n.expiry, n.title, n.content, n.who, u.username AS who_name FROM notifications n LEFT OUTER JOIN users u ON u.id = n.who WHERE CASE WHEN :expired THEN TRUE ELSE (SELECT EXTRACT(EPOCH FROM NOW())) < n.expiry OR n.expiry = 0 END ORDER BY n.time DESC")
                .bind("expired", expired)
                .map(new DBNotification.Mapper())
                .list());
    }

    /**
     * Gets a notifications by its ID.
     * @param id The notification ID.
     * @return A notification.
     */
    public DBNotification getNotification(int id) {
        return jdbi.withHandle(handle -> handle.select("SELECT n.id, n.time, n.expiry, n.title, n.content, n.who, u.username AS who_name FROM notifications n LEFT OUTER JOIN users u ON u.id = n.who WHERE n.id = :id")
                .bind("id", id)
                .map(new DBNotification.Mapper())
                .first());
    }

    /**
     * Updates an existing notification's expiry.
     * @param id The notification ID.
     * @param expiry The new notification expiry.
     */
    public void setNotificationExpiry(int id, long expiry) {
        jdbi.useHandle(handle -> handle.createUpdate("UPDATE notifications SET expiry = :expiry WHERE id = :id")
                .bind("expiry", expiry)
                .bind("id", id)
                .execute());
    }

    /**
     * @param creatorID The notification creator's {@link User} ID.
     * @param title The notification's title.
     * @param content The notification's content.
     * @param expiry The notification's expiry.
     * @return The created notification's ID.
     */
    public Integer createNotification(int creatorID, String title, String content, Long expiry) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO notifications (time, expiry, title, content, who) VALUES (EXTRACT(epoch FROM CURRENT_TIMESTAMP)::INTEGER, :expiry, :title, :content, :who)")
                .bind("who", creatorID)
                .bind("title", title)
                .bind("content", content)
                .bind("expiry", expiry)
                .executeAndReturnGeneratedKeys("id")
                    .mapTo(Integer.TYPE)
                    .first());
    }

    /* END NOTIFICATIONS */

    /* CHATBAN LOGS */

    /**
     * Initiates a new chat ban.
     * @param targetID The chat ban {@link User} ID.
     * @param initiatorID The chat ban initiator's {@link User} ID.
     * @param when When the chat ban was initiated.
     * @param type The chat ban type.
     * @param expiry The chat ban expiry epoch.
     * @param reason The chat ban reason.
     * @param purge Whether to purge all messages.
     * @return The inserted row ID.
     */
    public Integer initiateChatBan(int targetID, int initiatorID, long when, String type, long expiry, String reason, boolean purge) {
        return jdbi.withHandle(handle -> handle.createUpdate("INSERT INTO chatbans (target, initiator, \"when\", type, expiry, reason, purged) VALUES (:target, :initiator, :when, :type, :expiry, :reason, :purge)")
                .bind("target", targetID)
                .bind("initiator", initiatorID)
                .bind("when", when)
                .bind("type", type)
                .bind("expiry", expiry)
                .bind("reason", reason)
                .bind("purge", purge)
                .execute());
    }

    /**
     * Inserts a new chat ban by {@link Chatban} instance.
     * @param chatBan The {@link Chatban} instance.
     * @return The inserted row ID.
     */
    public Integer initiateChatBan(Chatban chatBan) {
        int targetID = chatBan.target != null ? chatBan.target.getId() : 0;
        int initiatorID = chatBan.initiator != null ? chatBan.initiator.getId() : 0;
        long when = chatBan.instantiatedMS / 1000L;
        String type = chatBan.type.toString();
        long expiry = chatBan.expiryTimeMS / 1000L;
        String reason = chatBan.reason;
        boolean purge = chatBan.purge;
        return initiateChatBan(targetID, initiatorID, when, type, expiry, reason, purge);
    }

    /* END CHATBAN LOGS */

    /**
     * Inserts the IP log pair. If the pair exists, <pre>last_used</pre> will be updated instead.
     * @param id The ID of the {@link User}.
     * @param ip The IP.
     */
    public void insertOrUpdateIPLog(int id, String ip) {
        jdbi.useHandle(handle -> handle.createUpdate("INSERT INTO ip_log (\"user\", \"ip\") VALUES (:id, :ip::INET) ON CONFLICT (\"user\", \"ip\") DO UPDATE SET \"last_used\" = NOW() WHERE \"ip_log\".\"user\" = :id AND \"ip_log\".\"ip\" = :ip::INET")
                .bind("id", id)
                .bind("ip", ip)
                .execute());
    }

    /**
     * Creates a new faction.<br>
     * Note: This is included for db access, but most faction operations should
     *       be done in the {@link space.pxls.user.FactionManager}.
     *
     * @param factionName The name of the faction.
     * @param factionTag The faction's tag.
     * @param owner_uid The owner's ID.
     * @param color The faction's color, or null for default.
     * @return The ID of the newly created faction, or null on insertion error.
     * @see space.pxls.user.FactionManager#create
     */
    public DBFaction createFaction(String factionName, String factionTag, int owner_uid, Integer color) {
        final Integer _color = color == null ? 0 : color;

        return jdbi.withHandle(handle -> {
            DBFaction toRet = handle.createQuery("INSERT INTO faction (\"name\", \"tag\", \"owner\", \"created\", \"color\", \"canvasCode\") VALUES (:name, :tag, :owner, now(), :color, :canvasCode) RETURNING *")
                .bind("name", factionName)
                .bind("tag", factionTag)
                .bind("owner", owner_uid)
                .bind("color", _color)
                .bind("canvasCode", App.getConfig().getString("canvascode"))
                .map(new DBFaction.Mapper())
                .findFirst()
                .orElse(null);
            if (toRet != null) {
                handle.createUpdate("INSERT INTO faction_membership (\"fid\", \"uid\") VALUES (:fid, :uid)")
                    .bind("fid", toRet.id)
                    .bind("uid", owner_uid)
                    .execute();
            }
            return toRet;
        });
    }

    /**
     * Gets the requested faction by ID.<br>
     * Note: This is included for db access, but most faction operations should
     *       be done in the {@link space.pxls.user.FactionManager}.
     *
     * @param fid The faction ID
     * @return The faction
     * @see space.pxls.user.FactionManager#getByID(Integer)
     */
    public DBFaction getFactionByID(int fid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM faction WHERE id = :fid")
                .bind("fid", fid)
                .map(new DBFaction.Mapper())
                .findFirst()
                .orElse(null)
        );
    }

    /**
     * Creates a new faction membership specified by (faction.id, user.id)
     *
     * @param fid The faction ID
     * @param uid The user ID
     */
    public void joinFaction(int fid, int uid) {
        jdbi.useHandle(handle ->
            handle.createUpdate("INSERT INTO faction_membership (\"fid\", \"uid\") VALUES (:fid, :uid) ON CONFLICT DO NOTHING")
                .bind("fid", fid)
                .bind("uid", uid)
                .execute()
        );
    }

    /**
     * Removes the faction membership specified by (faction.id, user.id)
     *
     * @param fid The faction ID
     * @param uid The user ID
     */
    public void leaveFaction(int fid, int uid) {
        jdbi.useHandle(handle -> {
            handle.createUpdate("UPDATE users SET displayed_faction=null WHERE id=:uid AND displayed_faction=:fid")
                .bind("uid", uid)
                .bind("fid", fid)
                .execute();
            handle.createUpdate("DELETE FROM faction_membership WHERE fid = :fid AND uid = :uid")
                .bind("fid", fid)
                .bind("uid", uid)
                .execute();
        });
    }

    /**
     * Gets factions that this user belongs to.
     *
     * @param uid The user's ID
     * @return The factions that this user belongs to.
     */
    public List<DBFaction> getFactionsForUID(int uid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM faction WHERE id IN (SELECT fid FROM faction_membership WHERE uid = :uid)")
                .bind("uid", uid)
                .map(new DBFaction.Mapper())
                .list()
        );
    }

    /**
     * Gets users that belong to the given faction.
     *
     * @param fid The faction's ID
     * @return A list of users that belong to the given faction
     */
    public List<DBUser> getUsersForFID(int fid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM users WHERE id IN (SELECT uid FROM faction_membership WHERE fid = :fid)")
                .bind("fid", fid)
                .map(new DBUser.Mapper())
                .list()
        );
    }

    /**
     * Gets the number of factions this user owns.
     *
     * @param uid The user's ID
     * @return The number of factions
     */
    public Integer getOwnedFactionCountForUID(int uid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT count(id) FROM faction WHERE owner = :uid")
                .bind("uid", uid)
                .mapTo(Integer.TYPE)
                .findFirst()
                .orElse(0)
        );
    }

    public List<DBUser> getBansForFID(int fid) {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM users WHERE id IN (SELECT uid FROM faction_ban WHERE fid = :fid)")
                .bind("fid", fid)
                .map(new DBUser.Mapper())
                .list()
        );
    }

    /**
     * Updates an existing faction in the database with the provided Faction
     * object.<br>
     * Note: This is included for db access, but most faction operations should
     *       be done in the {@link space.pxls.user.FactionManager}.
     *
     * @param faction The faction to update.
     *                Updates where `faction.id` = {@link Faction#getId()} and
     *                uses faction values where appropriate.
     * @see space.pxls.user.FactionManager#update(Faction, boolean)
     */
    public void updateFaction(Faction faction) {
        jdbi.useHandle(handle ->
            handle.createUpdate("UPDATE faction SET name=:name,tag=:tag,owner=:owner,color=:color WHERE id=:id")
                .bind("name", faction.getName())
                .bind("tag", faction.getTag())
                .bind("owner", faction.getOwner())
                .bind("id", faction.getId())
                .bind("color", faction.getColor())
                .execute()
        );
    }

    /**
     * Deletes the faction and removes all faction memberships.<br>
     * Note: This is included for db access, but most faction operations should
     *       be done in the {@link space.pxls.user.FactionManager}.
     *
     * @param fid The ID of the faction.
     *
     * @see space.pxls.user.FactionManager#deleteByID(int)
     */
    public void deleteFactionByFID(int fid) {
        jdbi.useHandle(handle -> { // only consume a single connection for these ops.
            handle.createUpdate("UPDATE users SET displayed_faction=null WHERE displayed_faction=:fid") // can't delete fid if there's a dependent present.
                .bind("fid", fid)
                .execute();
            handle.createUpdate("DELETE FROM faction_membership WHERE fid=:fid")
                .bind("fid", fid)
                .execute();
            handle.createUpdate("DELETE FROM faction_ban WHERE fid=:fid")
                .bind("fid", fid)
                .execute();
            handle.createUpdate("DELETE FROM faction WHERE id=:fid")
                .bind("fid", fid)
                .execute();
        });
    }

    /**
     * Deletes factions that do not have any members.
     *
     * @return A list of deleted orphaned factions.
     */
    public List<DBFaction> pruneOrphanedFactions() {
        return jdbi.withHandle(handle ->
            handle.createQuery("DELETE FROM faction WHERE id NOT IN (SELECT fid FROM faction_membership GROUP BY fid) RETURNING *")
                .map(new DBFaction.Mapper())
                .list()
        );
    }

    /**
     * Gets factions that do not currently have any members.
     *
     * @return A list of orphaned factions.
     */
    public List<DBFaction> getOrphanedFactions() {
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT * FROM faction WHERE id NOT IN (SELECT fid FROM faction_membership GROUP BY fid)")
                .map(new DBFaction.Mapper())
                .list()
        );
    }

    /**
     * Updates the user's displayed faction.
     *
     * @param uid The user's ID
     * @param fid The faction's ID, or null to unset.
     */
    public void setDisplayedFactionForUID(int uid, Integer fid) {
        jdbi.useHandle(handle ->
            handle.createUpdate("UPDATE users SET displayed_faction=:fid WHERE id=:uid")
                .bind("fid", fid)
                .bind("uid", uid)
                .execute()
        );
    }

    /**
     * Removes a faction ban for the given uid.
     *
     * @param uid The user's ID to remove
     * @param fid The faction ID to modify
     */
    public void removeFactionBanForUID(int uid, int fid) {
        jdbi.useHandle(handle -> handle.createUpdate("DELETE FROM faction_ban WHERE uid=:uid AND fid=:fid")
            .bind("uid", uid)
            .bind("fid", fid)
            .execute()
        );
    }

    /**
     * Adds a faction ban for the given uid. Will also remove an active
     *  faction_membership.
     *
     * @param uid The user's ID to add
     * @param fid The faction ID to modify
     */
    public void addFactionBanForUID(int uid, int fid) {
        jdbi.useHandle(handle -> {
            handle.createUpdate("DELETE FROM faction_membership WHERE uid=:uid AND fid=:fid")
                .bind("uid", uid)
                .bind("fid", fid)
                .execute();
            handle.createUpdate("INSERT INTO faction_ban (\"uid\", \"fid\") VALUES (:uid, :fid) ON CONFLICT DO NOTHING")
                .bind("uid", uid)
                .bind("fid", fid)
                .execute();
        });
    }

    /**
     * Sets a new owner for the faction. Does not verify faction_member state.
     *
     * @param fid The ID of the faction to modify
     * @param uid The ID of the user to set as owner
     */
    public void setFactionOwnerForFID(int fid, int uid) {
        jdbi.useHandle(handle ->
            handle.createUpdate("UPDATE faction SET owner = :uid WHERE id = :fid")
                .bind("fid", fid)
                .bind("uid", uid)
                .execute()
        );
    }

    /**
     * Performs a left-anchored case insensitive search with the given input.
     *  Supports basic pagination using the `after` param, which maps to a
     *  faction ID.
     *
     * @param search The search term
     * @param offset The pagination offset.
     * @param searchContext The user to add context from (currently,
     *                      "memberJoined"), or null for none.
     * @return A list of {@link DBFactionSearch}s.
     */
    public List<DBFactionSearch> searchFactions(String search, int offset, User searchContext) {
        // note (socc): there was no performance boost by indexing name and performing lower() searches rather than using ilike, regardless of where the anchor was.
        //              if something changes in future psql versions, we should reconfirm.
        return jdbi.withHandle(handle ->
            handle.createQuery("SELECT f.*,count(fm.fid) AS \"memberCount\",(case when :userCtx is null then false else exists(select fm1.fid from faction_membership fm1 where fm1.fid=f.id and fm1.uid=:userCtx) end) as \"userJoined\" FROM faction f INNER JOIN faction_membership fm ON fm.fid = f.id WHERE f.name ILIKE concat('%', :search, '%') OR f.tag ILIKE concat('%', :search, '%') GROUP BY f.id ORDER BY \"memberCount\" DESC, \"canvasCode\" DESC, \"id\" DESC LIMIT 50 OFFSET :offset")
                .bind("search", search)
                .bind("offset", offset)
                .bind("userCtx", searchContext == null ? null : searchContext.getId())
                .map(new DBFactionSearch.Mapper())
                .list()
        );
    }

    /**
     * Sets the color for this faction. Expects an integer value of a color.
     *
     * @param fid The faction's ID
     * @param color The integer value of a color.
     */
    public void setColorForFID(int fid, int color) {
        jdbi.useHandle(handle ->
            handle.createUpdate("UPDATE factions SET color = :color WHERE id = :fid")
                .bind("fid", fid)
                .bind("color", color)
                .execute()
        );
    }

    /**
     * Modifies the specified user's pixel count by a certain amount.
     * @param who The ID of the {@link User}.
     * @param amount The amount of pixels to increase the count with. Use a negative value to decrease pixels.
     * @param increaseCurrent Whenever to increase the pixel count for the current canvas.
     * @param increaseAllTime Whenever to increase the total pixel count of the user.
     * @return An instance of {@Link DBUserPixelCounts}.
     */
    public DBUserPixelCounts modifyPixelCounts(int who, int amount, boolean increaseCurrent, boolean increaseAllTime) {
        return jdbi.withHandle(handle ->
            handle.createQuery("UPDATE users SET pixel_count = pixel_count + :current_amount, pixel_count_alltime = pixel_count_alltime + :alltime_amount WHERE id = :who RETURNING pixel_count, pixel_count_alltime")
                .bind("who", who)
                .bind("current_amount", increaseCurrent ? amount : 0)
                .bind("alltime_amount", increaseAllTime ? amount : 0)
                .map(new DBUserPixelCounts.Mapper())
                .findFirst()
                .orElse(null)
        );
    }
}
