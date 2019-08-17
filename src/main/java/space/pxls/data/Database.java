package space.pxls.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.skife.jdbi.v2.DBI;
import org.skife.jdbi.v2.Handle;
import org.skife.jdbi.v2.tweak.HandleCallback;
import space.pxls.App;
import space.pxls.server.Badge;
import space.pxls.server.ChatMessage;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static java.lang.Math.toIntExact;

public class Database implements Closeable {
    private final DBI dbi;
    
    private Map<Thread,DatabaseHandle> handles = new ConcurrentHashMap<>();;

    public Database() {
        try {
            Class.forName("org.mariadb.jdbc.Driver");
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

        dbi = new DBI(new HikariDataSource(config));

        getHandle().createPixelsTable();
        getHandle().createUsersTable();
        getHandle().createSessionsTable();
        getHandle().createLookupsTable();
        getHandle().createAdminLogTable();
        getHandle().createReportsTable();
        getHandle().createStatsTable();
        getHandle().createAdminNotesTable();
        getHandle().createBanlogTable();
        getHandle().createChatMessagesTable();
        getHandle().createChatReportsTable();
    }

    private DAO getHandle() {
        Thread t = Thread.currentThread();
        DatabaseHandle h = handles.get(t);
        if (h != null) {
            h.lastUse = System.currentTimeMillis();
            return h.dao;
        }
        h = new DatabaseHandle();
        h.dao = dbi.open(DAO.class);
        h.lastUse = System.currentTimeMillis();
        App.getLogger().debug("Created new MariDB handle", h, h, h);
        handles.put(t, h);
        return h.dao;
    }

    public void cleanup() {
        for (Thread t : handles.keySet()) {
            DatabaseHandle d = handles.get(t);
            if (d.lastUse + (1000 * 60 * 5)  < System.currentTimeMillis()) {
                // ok destroy it
                App.getLogger().debug("Destroying MariaDB connection");
                d.dao.close();
                handles.remove(t);
            }
        }
    }

    public void placePixel(int x, int y, int color, User who, boolean mod_action) {
        int second_id = getHandle().getMostResentId(x, y);
        int whoID = who != null ? who.getId() : 0;
        getHandle().putPixel(x, y, (byte) color, whoID, mod_action, second_id);
        maybeIncreasePixelCount(mod_action, whoID);
    }

    public void updateUserTime(int uid, long seconds) {
        getHandle().updateUserTime(uid, seconds);
    }

    public DBPixelPlacement getPixelAt(int x, int y) {
        DBPixelPlacement pp;
        try {
            pp = getHandle().getPixel(x, y);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && pp.userId == 0) {
            return null;
        }
        return pp;
    }

    public DBPixelPlacementUser getPixelAtUser(int x, int y) {
        DBPixelPlacementUser pp;
        try {
            pp = getHandle().getPixelUser(x, y);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && (pp.username == null || pp.username.isEmpty())) {
            return null;
        }
        return pp;
    }

    public DBPixelPlacement getPixelByID(int id) {
        DBPixelPlacement pp;
        try {
            pp = getHandle().getPixel(id);
        } catch (NullPointerException e) {
            return null;
        }
        if (pp != null && pp.userId == 0) {
            return null;
        }
        return pp;
    }

    // returns ids of all pixels that should be rolled back and the DBPixelPlacement for all pixels to rollback to
    // DBRollbackPixel is (DBPixelPlacement and fromID) so it has all the info needed to rollback
    public List<DBRollbackPixel> getRollbackPixels(User who, int fromSeconds) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h
                .createQuery("SELECT id, secondary_id FROM pixels WHERE most_recent AND who = :who AND (time + INTERVAL :seconds SECOND > NOW())")
                .bind("who", who.getId())
                .bind("seconds", fromSeconds)
                .list(); //this selects all pixels by the banned user that are the most_recent
        List<DBRollbackPixel> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            DBPixelPlacement toPixel;
            try {
                int prevId = toIntExact((long) entry.get("secondary_id"));
                toPixel = getHandle().getPixel(prevId); //if previous pixel exists

                // while the user who placed the previous pixel is banned or previous pixel was undone
                while (toPixel.role.lessThan(Role.GUEST) || toPixel.ban_expiry > Instant.now().toEpochMilli() || toPixel.userId == who.getId() || toPixel.undoAction) {
                    if (toPixel.secondaryId != 0) {
                        toPixel = getHandle().getPixel(toPixel.secondaryId); //if is banned gets previous pixel
                    } else {
                        toPixel = null; // if is banned but no previous pixel exists return blank pixel
                        break; // and no reason to loop because blank pixel isn't placed by an user
                    }
                }
            } catch (NullPointerException e) { // .get() throws NullPointerException if secondary_id is NULL
                toPixel = null; //blank pixel
            }
            pixels.add(new DBRollbackPixel(toPixel, toIntExact((long) entry.get("id")))); //add and later return
        }
        h.close();
        return pixels;
    }

    public List<DBPixelPlacement> getUndoPixels(User who) {
        Handle h = dbi.open();
        List<Map<String, Object>> output = h
                .createQuery("SELECT DISTINCT secondary_id FROM pixels WHERE rollback_action AND who = :who AND secondary_id IS NOT NULL")
                .bind("who", who.getId())
                .list(); // this selects all pixels that we previously have rolled back.
        List<DBPixelPlacement> pixels = new ArrayList<>();
        for (Map<String, Object> entry : output) {
            int fromId = toIntExact((long) entry.get("secondary_id"));
            DBPixelPlacement fromPixel = getHandle().getPixel(fromId); // get the original pixel, the one that we previously rolled back

            boolean can_undo = getHandle().getCanUndo(fromPixel.x, fromPixel.y, fromPixel.id);
            if (can_undo) { // this basically checks if there are pixels that are more recent
                pixels.add(fromPixel); // add and later return
            }
        }
        h.close();
        return pixels;
    }

    public void putUndoPixel(int x, int y, int color, User who, int fromId) {
        int whoID = who == null ? 0 : who.getId();
        getHandle().putUndoPixel(x, y, (byte) color, whoID, fromId);
        maybeIncreasePixelCount(false, whoID);
    }

    public void putRollbackPixel(User who, int fromId, int toId) {
        getHandle().putRollbackPixel(who.getId(), fromId, toId);
        maybeIncreasePixelCount(who.getId());
    }

    public void putRollbackPixelNoPrevious(int x, int y, User who, int fromId) {
        getHandle().putRollbackPixelNoPrevious(x, y, who.getId(), fromId, App.getDefaultColor(x, y));
        maybeIncreasePixelCount(who.getId());
    }

    public void putNukePixel(int x, int y, int color) {
        DBPixelPlacement pp = getPixelAt(x, y);
        int whoID = pp == null ? 0 : pp.userId;
        getHandle().putNukePixel(x, y, color, whoID, pp != null && (pp.secondaryId > 0));
        maybeIncreasePixelCount(whoID);
    }

    public void putNukePixel(int x, int y, int replace, int color) {
        DBPixelPlacement pp = getPixelAt(x, y);
        int whoID = pp == null ? 0 : pp.userId;
        getHandle().putReplacePixel(x, y, replace, color, whoID, pp != null && (pp.secondaryId > 0));
        maybeIncreasePixelCount(whoID);
    }

    public DBPixelPlacement getUserUndoPixel(User who){
        return getHandle().getUserUndoPixel(who.getId());
    }

    public void putUserUndoPixel(DBPixelPlacement backPixel, User who, int fromId) {
        int whoID = who == null ? 0 : who.getId();
        getHandle().putUserUndoPixel(backPixel.x, backPixel.y, (byte) backPixel.color, whoID, backPixel.id, fromId);
        maybeIncreasePixelCount(whoID);
    }

    public void putUserUndoPixel(int x, int y, int color, User who, int fromId) {
        int whoID = who == null ? 0 : who.getId();
        getHandle().putUserUndoPixel(x, y, (byte) color, whoID, 0, fromId);
        maybeIncreasePixelCount(whoID);
    }

    public void close() {
        getHandle().close();
    }

    public DBUser getUserByLogin(String login) {
        return getHandle().getUserByLogin(login);
    }

    public DBUser getUserByName(String name) {
        return getHandle().getUserByName(name);
    }

    public DBUser getUserByID(int id) {
        return getHandle().getUserByID(id);
    }

    public DBUser getUserByToken(String token) {
        return getHandle().getUserByToken(token);
    }

    public DBUser createUser(String name, String login, String ip) {
        getHandle().createUser(name, login, ip);
        return getUserByName(name);
    }

    public void createSession(int who, String token) {
        getHandle().createSession(who, token);
    }

    public void destroySession(String token) {
        getHandle().destroySession(token);
    }

    public void updateSession(String token) {
        getHandle().updateSession(token);
    }

    public void setUserRole(User user, Role role) {
        getHandle().updateUserRole(user.getId(), role.name());
    }

    public void updateBan(User user, long timeFromNowSeconds) {
        getHandle().updateUserBan(user.getId(), timeFromNowSeconds);
    }

    public void updateBanReason(User user, String reason) {
        getHandle().updateUserBanReason(user.getId(), reason);
    }

    public void updateUseragent(User user, String agent) {
        getHandle().updateUseragent(user.getId(), agent);
    }

    public void updateUserIP(User user, String ip) {
        getHandle().updateUserIP(user.getId(), ip);
    }

    public void updateUserStacked(User user, int stacked) {
        getHandle().updateUserStacked(user.getId(), stacked);
    }

    /**
     * Gets whether or not the user has been requested to change their username.
     * @param who_id The ID of the user to check.
     * @return Whether or not the user has been requested to change their username.
     */
    public boolean isRenameRequested(int who_id) {
        return getHandle().isRenameRequested(who_id);
    }

    /**
     * Sets whether or not the user has been requested to change their username.
     * @param who_id The ID of the user to update.
     * @param is_requested Whether or not a updateUsername is being requested.
     */
    public void setRenameRequested(int who_id, boolean is_requested) {
        getHandle().setRenameRequested(who_id, is_requested);
    }

    /**
     * Updates the requested user's username. <strong>Does not do any collision checks</strong>.
     * @param who_id The ID of the user to update.
     * @param new_username The new username.
     */
    public void updateUsername(int who_id, String new_username) {
        getHandle().updateUsername(who_id, new_username);
    }

    public String getUserBanReason(int id) {
        return getHandle().getUserBanReason(id).ban_reason;
    }

    public int getUserPixels(int id) {
        return getHandle().getUserPixels(id).pixel_count;
    }

    public int getUserPixelsAllTime(int id) {
        return getHandle().getUserPixelsAllTime(id).pixel_count_alltime;
    }

    public void clearOldSessions() {
        getHandle().clearOldSessions();
    }

    public boolean didPixelChange(int x, int y) {
        return getHandle().didPixelChange(x, y);
    }

    public boolean shouldPixelTimeIncrease(int x, int y, int who) {
        return App.getConfig().getBoolean("selfPixelTimeIncrease") ? didPixelChange(x, y) : getHandle().shouldPixelTimeIncrease(x, y, who);
    }

    public void adminLog(String message, int uid) {
        getHandle().adminLog(message, uid);
    }

    public void adminLogServer(String message) {
        getHandle().adminLogServer(message);
    }

    public void addReport(int whosReporting, int userReported, int pixel_id, int x, int y, String message) {
        getHandle().addReport(whosReporting, userReported, pixel_id, x, y, message);
    }

    public void addServerReport(String message, int reported) {
        getHandle().addServerReport(message, reported);
    }

    public boolean haveDupeIp(String ip, int uid) {
        return getHandle().haveDupeIp(ip, uid);
    }

    public void addLookup(Integer who, String ip) {
        getHandle().putLookup(who, ip);
    }

    /**
     *
     * @param banned_at_ms The milisecond timestamp the user was banned at
     * @param banner_uid The UID of the person who did the actual ban. Special cases: null for console, and the `who_got_banned` for self-bans.
     * @param banned_uid The UID of the person who's being banned.
     * @param ban_expiry_ms The milisecond timestamp of when the ban will expire
     * @param ban_action The type of ban (permaban/unban/etc)
     * @param ban_reason The reason for the (un)ban
     */
    public void insertBanlog(long banned_at_ms, Integer banner_uid, int banned_uid, Long ban_expiry_ms, String ban_action, String ban_reason) {
        if (ban_expiry_ms == null) ban_expiry_ms = 0L;
        banned_at_ms /= 1000L;
        ban_expiry_ms /= 1000L;
        getHandle().insertBanlog(banned_at_ms, banner_uid, banned_uid, ban_expiry_ms, ban_action, ban_reason);
    }

    /* CHAT */

    /**
     * @param author The {@link User} who sent the chat message
     * @param sent_at The epoch timestamp of when the message was sent
     * @param message The raw content of the message
     * @param filtered The filtered content of the message
     * @author GlowingSocc
     */
    public String insertChatMessage(User author, long sent_at, String message, String filtered) {
        return insertChatMessage(author == null ? -1 : author.getId(), sent_at, message, filtered);
    }

    /**
     * @param author_uid The ID of the user who sent the chat message
     * @param sent_at_ms The epoch MS timestamp of when the message was sent
     * @param content The raw content of the message
     * @param filtered The filtered content of the message
     * @return The nonce of the message
     * @author GlowingSocc
     */
    public String insertChatMessage(int author_uid, long sent_at_ms, String content, String filtered) {
        String nonce = java.util.UUID.randomUUID().toString();
        getHandle().insertChatMessage(author_uid, sent_at_ms / 1000L, content, filtered, nonce);
        return nonce;
    }

    /**
     * Fetches the {@link DBChatMessage} associated with the given <pre>nonce</pre>
     * @param nonce The nonce of the {@link DBChatMessage} to fetch.
     * @return The {@link DBChatMessage}, or <pre>null</pre> if it doesn't exist.
     * @author GlowingSocc
     */
    public DBChatMessage getChatMessageByNonce(String nonce) {
        return getHandle().getChatMessageByNonce(nonce);
    }

    /**
     * Fetches <em>all</em> chat messages for the specified author, sorted by date sent descending.
     * @param author_uid The user ID of the author.
     * @return An array of {@link DBChatMessage}s
     * @author GlowingSocc
     */
    public DBChatMessage[] getChatMessagesForAuthor(int author_uid) {
        return getHandle().getChatMessagesForAuthor(author_uid);
    }

    /**
     * Retrieves the last <span>x</span> chat messages.<br />
     * @param x The amount of chat messages to retrieve.
     * @param includePurged Whether or not to include purged messages.
     * @return An array of {@link DBChatMessage}s. Array length is bound to ResultSet size, not the `<pre>x</pre>` param.
     * @author GlowingSocc
     */
    public DBChatMessage[] getLastXMessages(int x, boolean includePurged) {
        return dbi
                .withHandle(handle -> handle.createQuery("SELECT * FROM chat_messages WHERE " + (includePurged ? "1" : "purged=0") + " ORDER BY sent DESC LIMIT :lim").bind("lim", x).map(new DBChatMessage.Mapper()).list())
                .toArray(new DBChatMessage[0]);
    }

    /**
     * Retrieves the last <span>x</span> chat messages and parses them for easier frontend handling.<br />
     * @param x The amount of chat messages to retrieve.
     * @param includePurged Whether or not to include purged messages.
     * @param ignoreFilter If true, filtered messages will return their original content.
     * @return An array of {@link DBChatMessage}s. Array length is bound to ResultSet size, not the `<pre>x</pre>` param.
     * @author GlowingSocc
     */
    public List<ChatMessage> getlastXMessagesForSocket(int x, boolean includePurged, boolean ignoreFilter) {
        DBChatMessage[] fromDB = getLastXMessages(x, includePurged);
        List<ChatMessage> toReturn = new ArrayList<>();
        for (DBChatMessage dbChatMessage : fromDB) {
            List<Badge> badges = new ArrayList<>();
            String author = "CONSOLE";
            String parsedMessage = dbChatMessage.content; //TODO https://github.com/atlassian/commonmark-java
            if (dbChatMessage.author_uid > 0) {
                author = "$Unknown";
                User temp = App.getUserManager().getByID(dbChatMessage.author_uid);
                if (temp != null) {
                    author = temp.getName();
                    badges = temp.getChatBadges();
                }
            }
            toReturn.add(new ChatMessage(dbChatMessage.nonce, author, dbChatMessage.sent, App.getConfig().getBoolean("chat.filter.enabled") && !ignoreFilter && dbChatMessage.filtered_content.length() > 0 ? dbChatMessage.filtered_content : dbChatMessage.content, badges));
        }
        return toReturn;
    }

    /**
     * Updates a user's perma chatban state/ Does not update the expiry.
     * @param toUpdate The {@link User} to update
     * @param isPermaChatbanned Whether or not the user should be permanently chatbanned
     * @see #updateUserChatbanExpiry(User, long)
     * @author GlowingSocc
     */
    public void updateUserChatbanPerma(User toUpdate, boolean isPermaChatbanned) {
        if (toUpdate == null) throw new IllegalArgumentException("Cannot update a non-existant user's chatban");
        updateUserChatbanPerma(toUpdate.getId(), isPermaChatbanned);
    }

    /**
     * Updates a user's perma chatban state. Does not update the expiry.
     * @param toUpdateUID The {@link User}'s ID to update.
     * @param isPermaChatbanned Whether or not the user should be permanently chatbanned
     * @see #updateUserChatbanExpiry(int, long)
     * @author GlowingSocc
     */
    public void updateUserChatbanPerma(int toUpdateUID, boolean isPermaChatbanned) {
        getHandle().updateUserChatbanPerma(isPermaChatbanned ? 1 : 0, toUpdateUID);
    }

    /**
     * Updates the user's chatban expiry. Does not update the 'permaban' state.
     * @param toUpdate The {@link User} to update
     * @param chatBanExpiry The timestamp in milliseconds of when the chatban expires.
     * @see #updateUserChatbanExpiry(User, long)
     * @author GlowingSocc
     */
    public void updateUserChatbanExpiry(User toUpdate, long chatBanExpiry) {
        if (toUpdate == null) throw new IllegalArgumentException("Cannot update a non-existant user's chatban");
        updateUserChatbanExpiry(toUpdate.getId(), chatBanExpiry);
    }

    /**
     * Updates the user's chatban expiry. Does not update the 'permaban' state.
     * @param toUpdateUID The {@link User}'s ID to update
     * @param chatBanExpiry The timestamp in milliseconds of when the chatban expires.
     * @see #updateUserChatbanExpiry(int, long)
     * @author GlowingSocc
     */
    public void updateUserChatbanExpiry(int toUpdateUID, long chatBanExpiry) {
        getHandle().updateUserChatbanExpiry(new Timestamp(chatBanExpiry), toUpdateUID);
    }

    public void handlePurge(User target, User initiator, int amount, String reason, boolean broadcast) {
        String partLimit = amount == Integer.MAX_VALUE ? "" : " LIMIT 0, " + amount + " ";
        dbi.withHandle(handle -> handle.createStatement("UPDATE chat_messages SET purged=1,purged_by=:initiator WHERE nonce IN (  SELECT nonce FROM (  SELECT nonce FROM chat_messages WHERE author = :author ORDER BY sent DESC" + partLimit + " ) temp  );")
                .bind("initiator", initiator != null ? initiator.getId() : 0)
                .bind("author", target.getId())
                .execute());
        adminLogServer(String.format("<%s, %s> purged %s messages from <%s, %s>%s.", (initiator == null) ? "CONSOLE" : initiator.getName(), (initiator == null) ? 0 : initiator.getId(), amount, target.getName(), target.getId(), ((reason != null) && (reason.length() > 0)) ? (" because: " + reason) : ""));
        if (broadcast) {
            App.getServer().getPacketHandler().sendChatPurge(target, initiator, amount, reason);
        }
    }

    /**
     * Adds a chat report
     * @param messageNonce The {@link ChatMessage}'s nonce
     * @param target The {@link User} who is being reported
     * @param initiator The {@link User} who is doing the reporting
     * @param reportMessage The body of the report from the user
     */
    public void addChatReport(String messageNonce, User target, User initiator, String reportMessage) {
        addChatReport(messageNonce, target.getId(), initiator == null ? 0 : initiator.getId(), reportMessage);
    }

    /**
     * Adds a chat report
     * @param messageNonce The {@link ChatMessage}'s nonce
     * @param target The {@link User}'s ID who is being reported
     * @param initiator The {@link User}'s ID who is doing the reporting
     * @param reportMessage The body of the report from the user
     */
    public void addChatReport(String messageNonce, int target, int initiator, String reportMessage) {
        getHandle().addChatReport(messageNonce, target, initiator, reportMessage);
    }

    /**
     * Purges the specified chat message
     * @param messageNonce The {@link ChatMessage}'s nonce to purge
     * @param purger_uid The {@link User}'s ID who purged the chat message
     */
    public void purgeChatMessageByNonce(String messageNonce, int purger_uid) {
        getHandle().purgeChatMessageByNonce(messageNonce, purger_uid);
    }

    /**
     * Gets the chatban reason for the specified {@link User}'s ID.
     * @param id The {@link User}'s ID to target
     * @return The chatban reason.
     */
    public String getChatbanReasonForUser(int id) {
        return getHandle().getChatbanReasonForUser(id);
    }

    /**
     * Updates the chatban for the {@link User}'s ID.
     * @param id The {@link User}'s ID to target
     * @param reason The chatban reason.
     */
    public void updateUserChatbanReason(int id, String reason) {
        getHandle().updateUserChatbanReason(id, reason);
    }

    /* END CHAT */

    //UPDATE users SET pixel_count = IF(pixel_count, pixel_count-1, 0), pixel_count_alltime = IF(pixel_count_alltime, pixel_count_alltime-1, 0) WHERE id = :who
    private void maybeIncreasePixelCount(int whoID) {
        if (App.shouldIncreaseSomePixelCount()) {
            dbi.withHandle((HandleCallback<Void>) handle -> {
                if (App.getConfig().getBoolean("pixelCounts.countTowardsAlltime")) {
                    handle.createStatement("UPDATE users SET pixel_count_alltime = IF(pixel_count_alltime, pixel_count_alltime-1, 0) WHERE id = :who")
                            .bind("who", whoID)
                            .execute();
                }
                if (App.getConfig().getBoolean("pixelCounts.countTowardsCurrent")) {
                    handle.createStatement("UPDATE users SET pixel_count = IF(pixel_count, pixel_count-1, 0) WHERE id = :who")
                            .bind("who", whoID)
                            .execute();
                }
                return null;
            });
        }
    }

    private void maybeIncreasePixelCount(boolean modAction, int whoID) {
        if (App.shouldIncreaseSomePixelCount()) {
            dbi.withHandle((HandleCallback<Void>) handle -> {
                if (App.getConfig().getBoolean("pixelCounts.countTowardsAlltime")) {
                    handle.createStatement("UPDATE users SET pixel_count_alltime = pixel_count_alltime + (1 - :mod) WHERE id = :who")
                            .bind("mod", modAction)
                            .bind("who", whoID)
                            .execute();
                }
                if (App.getConfig().getBoolean("pixelCounts.countTowardsCurrent")) {
                    handle.createStatement("UPDATE users SET pixel_count = pixel_count + (1 - :mod) WHERE id = :who")
                            .bind("mod", modAction)
                            .bind("who", whoID)
                            .execute();
                }
                return null;
            });
        }
    }

    class DatabaseHandle {
        public DAO dao;
        public long lastUse;
    }
}
