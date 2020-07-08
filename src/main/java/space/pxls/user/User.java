package space.pxls.user;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.data.DBUser;
import space.pxls.data.DBUserPixelCounts;
import space.pxls.server.packets.chat.Badge;
import space.pxls.server.packets.chat.ServerChatUserUpdate;
import space.pxls.server.packets.socket.ClientUndo;
import space.pxls.server.packets.chat.ServerChatBan;
import space.pxls.server.packets.socket.ServerRename;
import space.pxls.util.RateLimitFactory;

import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class User {
    private int id;
    private int stacked;
    private int chatNameColor;
    private String name;
    private String login;
    private String useragent;
    private List<Role> roles;
    private int pixelCount;
    private int pixelCountAllTime;
    private boolean overrideCooldown;
    private boolean flaggedForCaptcha = true;
    private boolean justShowedCaptcha;
    private boolean lastPlaceWasStack = false;
    private AtomicBoolean placingLock = new AtomicBoolean(false);
    private AtomicBoolean undoLock = new AtomicBoolean(false);
    private boolean isPermaChatbanned = false;
    private boolean isRenameRequested = false;
    private boolean isIdled = false;
    private String discordName;
    private String chatbanReason;
    private long cooldownExpiry;
    private long lastPixelTime = 0;
    private long initialAuthTime = 0L;
    private Timestamp signup_time;
    private Integer displayedFaction;
    private Boolean factionBlocked;

    private boolean shadowBanned;
    // 0 = not banned
    private Long banExpiryTime;
    private long chatbanExpiryTime;

    private Set<WebSocketChannel> connections = new HashSet<>();

    public User(int id, int stacked, String name, String login, Timestamp signup, long cooldownExpiry, List<Role> roles, int pixelCount, int pixelCountAllTime, Long banExpiryTime, boolean shadowBanned, boolean isPermaChatbanned, long chatbanExpiryTime, String chatbanReason, int chatNameColor, Integer displayedFaction, String discordName, Boolean factionBlocked) {
        this.id = id;
        this.stacked = stacked;
        this.name = name;
        this.login = login;
        this.signup_time = signup;
        this.cooldownExpiry = cooldownExpiry;
        this.roles = roles;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.banExpiryTime = banExpiryTime;
        this.shadowBanned = shadowBanned;
        this.isPermaChatbanned = isPermaChatbanned;
        this.chatbanExpiryTime = chatbanExpiryTime;
        this.chatbanReason = chatbanReason;
        this.chatNameColor = chatNameColor;
        this.displayedFaction = displayedFaction;
        this.discordName = discordName;
        this.factionBlocked = factionBlocked;
    }

    public void reloadFromDatabase() {
        DBUser user = App.getDatabase().getUserByID(id).orElse(null);
        if (user != null) {
            List<Role> roles = App.getDatabase().getUserRoles(user.id);
            this.id = user.id;
            this.stacked = user.stacked;
            this.name = user.username;
            this.login = user.login;
            this.signup_time = user.signup_time;
            this.cooldownExpiry = user.cooldownExpiry;
            this.roles = roles;
            this.banExpiryTime = user.banExpiry;
            this.isPermaChatbanned = user.isPermaChatbanned;
            this.chatbanExpiryTime = user.chatbanExpiry;
            this.isRenameRequested = user.isRenameRequested;
            this.discordName = user.discordName;
            this.chatbanReason = user.chatbanReason;
            this.chatNameColor = user.chatNameColor;
            this.displayedFaction = user.displayedFaction;
            this.factionBlocked = user.factionBlocked;
        }
    }

    public int getId() {
        return id;
    }

    public boolean canPlace() {
        if (isRenameRequested) return false;

        if (hasPermission("board.cooldown.override") && overrideCooldown) return true;
        if (!hasPermission("board.place")) return false;
        return cooldownExpiry < System.currentTimeMillis();
    }

    public boolean undoWindowPassed() {
        return lastPixelTime + App.getConfig().getDuration("undo.window", TimeUnit.MILLISECONDS) < System.currentTimeMillis();
    }

    public boolean canUndo() {
        return canUndo(true);
    }
    public boolean canUndo(boolean hitBucket) {
        if (!hasPermission("board.undo")) return false;
        int rem = RateLimitFactory.getTimeRemaining(ClientUndo.class, String.valueOf(this.id), hitBucket);
        return rem == 0;
    }

    public void setLastPixelTime(boolean flagNotIdle) {
        lastPixelTime = System.currentTimeMillis();
        if (flagNotIdle) setIdled(false);
    }
    public void setLastPixelTime() {
        setLastPixelTime(false);
    }

    public long getLastPixelTime() {
        return this.lastPixelTime;
    }

    public float getRemainingCooldown() {
        if (hasPermission("board.cooldown.override") && overrideCooldown) return 0;

        return Math.max(0, cooldownExpiry - System.currentTimeMillis()) / 1000f;
    }

    public boolean updateCaptchaFlagPrePlace() {
        if (hasPermission("board.captcha.ignore")) {
            flaggedForCaptcha = false;
            return false;
        }

        if (flaggedForCaptcha) return true;

        // Don't show captcha if we *just* had one and haven't had the chance to place yet
        // or if the user is placing a stack
        if (justShowedCaptcha || stacked > 1) {
            flaggedForCaptcha = false;
            justShowedCaptcha = false;
            return false;
        }

        int captchaThreshold = App.getConfig().getInt("captcha.threshold");
        if (Math.random() < (1f / captchaThreshold)) {
            flaggedForCaptcha = true;
        }

        return flaggedForCaptcha;
    }

    public void setOverrideCooldown(boolean overrideCooldown) {
        this.overrideCooldown = hasPermission("board.cooldown.override") && overrideCooldown;
    }

    public List<Role> getRoles() {
        return roles;
    }

    public List<Role> getAllRoles() {
        return Stream.of(roles, Role.getGuestRoles(), Role.getDefaultRoles())
                .flatMap(Collection::stream)
                .collect(Collectors.toList());
    }

    public String getRolesString() {
        if (roles.isEmpty()) return "";
        return roles.stream()
                .map(Role::getName)
                .collect(Collectors.joining(", "));
    }

    public String getRoleIDsString() {
        if (roles.isEmpty()) return "";
        return roles.stream()
                .map(Role::getID)
                .collect(Collectors.joining(","));
    }

    public boolean hasPermission(String node) {
        return Stream.of(Role.getGuestRoles(), Role.getDefaultRoles(), roles)
                .flatMap(Collection::stream)
                .anyMatch(role -> role.hasPermission(node));
    }

    public String getLogin() {
        return login;
    }

    private void sendUserData() {
        for (WebSocketChannel ch : connections) {
            App.getServer().getPacketHandler().userdata(ch, this);
        }
    }

    public void setRoles(List<Role> rolesToSet) {
        setRoles(rolesToSet, false);
    }

    public void setRoles(List<Role> rolesToSet, boolean skipSendUserData) {
        this.roles = rolesToSet;
        App.getDatabase().setUserRoles(this.getId(), roles);
        if (!skipSendUserData) sendUserData();
    }

    public void addRoles(List<Role> rolesToAdd) {
        addRoles(rolesToAdd, false);
    }

    public void addRoles(List<Role> rolesToAdd, boolean skipSendUserData) {
        var newRoles = new ArrayList<>(rolesToAdd);
        for (var role : roles) {
            if (!newRoles.contains(role)) newRoles.add(role);
        }
        setRoles(newRoles, skipSendUserData);
    }

    public void addRole(Role role, boolean skipSendUserData) {
        addRoles(List.of(role), skipSendUserData);
    }

    public void removeRoles(List<Role> rolesToRemove) {
        removeRoles(rolesToRemove, false);
    }

    public void removeRoles(List<Role> rolesToRemove, boolean skipSendUserData) {
        var newRoles = new ArrayList<>(roles);
        newRoles.removeAll(rolesToRemove);
        setRoles(newRoles, skipSendUserData);
    }

    public void removeRole(Role role, boolean skipSendUserData) {
        removeRoles(List.of(role), skipSendUserData);
    }

    public String getBanReason() {
        return App.getDatabase().getUserBanReason(this.id);
    }

    public void setBanReason(String reason) {
        App.getDatabase().updateBanReason(this, reason);
    }

    public void setCooldown(int seconds) {
        cooldownExpiry = System.currentTimeMillis() + (seconds * 1000);
    }

    public boolean isOverridingCooldown() {
        if (hasPermission("board.cooldown.override")) return overrideCooldown;
        return (overrideCooldown = false);
    }

    public void validateCaptcha() {
        flaggedForCaptcha = false;
        justShowedCaptcha = true;
    }

    public boolean isFlaggedForCaptcha() {
        return flaggedForCaptcha;
    }

    public void flagForCaptcha() {
        flaggedForCaptcha = true;
    }

    public String getName() {
        return name;
    }

    public String getTag() {
        Faction f = fetchDisplayedFaction();
        if (f != null) {
            return f.getTag();
        }
        return null;
    }

    public List<Badge> getChatBadges() {
        List<Badge> toReturn = new ArrayList<>();

        getRoles().forEach(role -> toReturn.addAll(role.getBadges()));

        if (!App.getConfig().getBoolean("oauth.snipMode")) {
            if (this.pixelCountAllTime >= 1000000) {
                toReturn.add(new Badge("1m+", "1m+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 900000) {
                toReturn.add(new Badge("900k+", "900k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 800000) {
                toReturn.add(new Badge("800k+", "800k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 700000) {
                toReturn.add(new Badge("700k+", "700k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 600000) {
                toReturn.add(new Badge("600k+", "600k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 500000) {
                toReturn.add(new Badge("500k+", "500k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 400000) {
                toReturn.add(new Badge("400k+", "400k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 300000) {
                toReturn.add(new Badge("300k+", "300k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 200000) {
                toReturn.add(new Badge("200k+", "200k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 100000) {
                toReturn.add(new Badge("100k+", "100k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 50000) {
                toReturn.add(new Badge("50k+", "50k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 25000) {
                toReturn.add(new Badge("25k+", "25k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 10000) {
                toReturn.add(new Badge("10k+", "10k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 5000) {
                toReturn.add(new Badge("5k+", "5k+ Pixels Placed", "text", null));
            } else if (this.pixelCountAllTime >= 1000) {
                toReturn.add(new Badge("1k+", "1k+ Pixels Placed", "text", null));
            } else {
                toReturn.add(new Badge("<1k", "<1k Pixels Placed", "text", null));
            }
        }

        return toReturn;
    }

    public boolean isBanned() {
        return banExpiryTime != null && (banExpiryTime == 0 || banExpiryTime > System.currentTimeMillis());
    }

    public boolean isShadowBanned() {
        return shadowBanned;
    }

    public Long getBanExpiryTime() {
        return banExpiryTime;
    }

    private void setBanExpiryTime(Integer timeFromNowSeconds) {
        setBanExpiryTime(timeFromNowSeconds, false);
    }

    private void setBanExpiryTime(Integer timeFromNowSeconds, boolean skipSendUserData) {
        // timeFromNowSeconds
        //   null = unban
        //   0 = perma
        //   n = timed
        if (timeFromNowSeconds == null) {
            this.banExpiryTime = null;
        } else if (timeFromNowSeconds == 0) {
            this.banExpiryTime = 0L;
        } else {
            this.banExpiryTime = (timeFromNowSeconds*1000) + System.currentTimeMillis();
        }
        App.getDatabase().updateBan(this, timeFromNowSeconds);
        if (!skipSendUserData) sendUserData();
    }

    public boolean canChat() {
        if (App.getConfig().getBoolean("chat.canvasBanRespected") && isBanned()) {
            return false;
        }
        return !isChatbanned();
    }

    public boolean isChatbanned() {
        return this.isPermaChatbanned || this.chatbanExpiryTime > System.currentTimeMillis();
    }

    public void chatban(Chatban chatban, boolean doLog) {
        switch (chatban.type) {
            case TEMP: {
                this.isPermaChatbanned = false;
                this.chatbanExpiryTime = chatban.expiryTimeMS;
                this.chatbanReason = chatban.reason;
                App.getServer().getPacketHandler().sendChatban(this, new ServerChatBan(false, chatban.reason, chatban.expiryTimeMS));
                App.getDatabase().updateChatBanReason(getId(), chatban.reason);
                break;
            }
            case PERMA: {
                this.isPermaChatbanned = true;
                this.chatbanReason = chatban.reason;
                App.getServer().getPacketHandler().sendChatban(this, new ServerChatBan(true, chatban.reason, null));
                App.getDatabase().updateChatBanReason(getId(), chatban.reason);
                break;
            }
            case UNBAN: {
                this.isPermaChatbanned = false;
                this.chatbanExpiryTime = chatban.expiryTimeMS;
                this.chatbanReason = chatban.reason;
                App.getServer().getPacketHandler().sendChatban(this, new ServerChatBan(false, chatban.reason, 0L));
                break;
            }
        }

        App.getDatabase().updateChatBanPerma(getId(), isPermaChatbanned);
        App.getDatabase().updateChatBanExpiry(getId(), chatbanExpiryTime);

        if (chatban.purge && chatban.purgeAmount > 0) {
            App.getDatabase().purgeChat(chatban.target, chatban.initiator, chatban.purgeAmount, "Chatban purge: " + chatban.reason, true);
        }

        if (doLog) {
            if (chatban.initiator == null) {
                App.getDatabase().insertServerAdminLog(chatban.toString());
            } else {
                App.getDatabase().insertAdminLog(chatban.initiator.getId(), chatban.toString());
            }
            App.getDatabase().initiateChatBan(chatban);
        }
    }

    public void chatban(Chatban chatban) {
        chatban(chatban, true);
    }

    public Set<WebSocketChannel> getConnections() {
        return connections;
    }

    public void shadowBan(String reason, int rollbackTime, User banner) {
        setBanReason(reason);
        shadowBanned = true;
        App.getDatabase().updateUserShadowBanned(this, true);
        App.rollbackAfterBan(this, rollbackTime);
        App.getDatabase().insertBanLog(banner == null ? 0 : banner.getId(), this.getId(), System.currentTimeMillis(), 0L, "shadowban", reason);
    }

    public void shadowBan(String reason, User banner) {
        shadowBan(reason, 24*3600, banner);
    }

    public void ban(Integer timeFromNowSeconds, String reason, User banner) {
        ban(timeFromNowSeconds, reason, 24 * 3600, banner);
    }

    public void ban(Integer timeFromNowSeconds, String reason, int rollbackTime, User banner) {
        setBanReason(reason);
        setBanExpiryTime(timeFromNowSeconds, false);
        App.rollbackAfterBan(this, rollbackTime);
        long now = System.currentTimeMillis();
        int bannerId = banner == null ? 0 : banner.getId();
        if (timeFromNowSeconds == null) {
            App.getDatabase().insertBanLog(bannerId, this.getId(), now, 0L, "permaban", reason);
        } else {
            App.getDatabase().insertBanLog(bannerId, this.getId(), now, now + (timeFromNowSeconds * 1000), "ban", reason);
        }
    }

    public void unban(User whoUnbanned, String unbanReason) {
        setBanExpiryTime(null);
        App.getDatabase().updateUserShadowBanned(this, false);
        App.undoRollback(this);
        long now = System.currentTimeMillis();
        App.getDatabase().insertBanLog(whoUnbanned == null ? 0 : whoUnbanned.getId(), this.getId(), now, null, "unban", unbanReason);
    }

    public void setUserAgent(String s) {
        useragent = s;
        App.getDatabase().updateUserAgent(this, s);
    }

    public String getUserAgent() {
        return useragent;
    }

    public int getStacked() {
        return stacked;
    }

    public void setStacked(int stacked) {
        this.stacked = stacked;
        App.getDatabase().updateUserStacked(this, stacked);
    }

    public long getInitialAuthTime() {
        return initialAuthTime;
    }

    public void setInitialAuthTime(long initialAuthTime) {
        this.initialAuthTime = initialAuthTime;
    }

    public boolean lastPlaceWasStack() {
        return lastPlaceWasStack;
    }

    public void setLastPlaceWasStack(boolean lastPlaceWasStack) {
        this.lastPlaceWasStack = lastPlaceWasStack;
    }

    public void tickStack() {
        tickStack(true);
    }

    private int addToN(int n) {
        int s = 0;
        for (int i = 1; i <= n; i++) {
            s += i;
        }
        return s;
    }

    public void tickStack(boolean sendRes) {
        int multiplier = App.getStackMultiplier();
        int maxStacked = App.getStackMaxStacked();

        int curCD = App.getServer().getPacketHandler().getCooldown();

        long lastPixelTime = getLastPixelTime() == 0 ? (this.cooldownExpiry == 0 ? getInitialAuthTime() : (this.cooldownExpiry - (curCD*1000))) : getLastPixelTime();
        if (lastPixelTime == 0) {
            return;
        }
        long delta = (System.currentTimeMillis()-lastPixelTime) / 1000;
        //App.getLogger().debug("=======");
        while(true) {
            int target = (curCD * multiplier) * (2 + getStacked() + addToN(getStacked()));
            //App.getLogger().debug(delta);
            //App.getLogger().debug(" : ");
            //App.getLogger().debug(target);
            if (delta >= target && getStacked() < maxStacked) {
                setStacked(getStacked() + 1);
                if (sendRes) {
                    App.getServer().getPacketHandler().sendAvailablePixels(this, "stackGain");
                }
                continue;
            }
            return;
        }
    }

    private void modifyPixelCounts(int amount) {
        boolean increaseCurrent = App.getConfig().getBoolean("pixelCounts.countTowardsCurrent");
        boolean increaseAllTime = App.getConfig().getBoolean("pixelCounts.countTowardsAlltime");

        if (!increaseCurrent && !increaseAllTime) {
            // Don't waste resources updating nothing.
            return;
        }

        DBUserPixelCounts newCounts = App.getDatabase().modifyPixelCounts(this.id, amount, increaseCurrent, increaseAllTime);
        this.pixelCount = newCounts.pixelCount;
        this.pixelCountAllTime = newCounts.pixelCountAllTime;
    }

    public void increasePixelCounts() {
        this.modifyPixelCounts(+1);
    }

    public void decreasePixelCounts() {
        this.modifyPixelCounts(-1);
    }

    public int getPixelCount() {
        return this.pixelCount;
    }

    public int getAllTimePixelCount() {
        return this.pixelCountAllTime;
    }

    public int getAvailablePixels() {
        boolean canPlace = canPlace();
        if (!canPlace) return 0;

        return (canPlace ? 1 : 0) + this.stacked;
    }

    public void setRenameRequested(boolean isRequested) {
        this.isRenameRequested = isRequested;
        App.getDatabase().setRenameRequested(id, isRequested);
        App.getServer().send(this, new ServerRename(isRequested));
    }

    public boolean isRenameRequested(boolean reloadFromDatabase) {
        if (reloadFromDatabase) this.isRenameRequested = App.getDatabase().isRenameRequested(id);
        return isRenameRequested;
    }

    public boolean updateUsername(String newName) {
        return updateUsername(newName, false);
    }

    public boolean updateUsername(String newName, boolean ignoreRequestedStatus) {
        if (!ignoreRequestedStatus && !isRenameRequested) return false;
        if (App.getDatabase().getUserByName(newName).isPresent()) return false;
        try {
            App.getDatabase().updateUsername(id, newName);
            App.getDatabase().insertAdminLog(id, String.format("User %s (%d) has just changed their name to %s", name, id, newName));
            App.getUserManager().reload();
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
        return true;
    }

    public String getDiscordName() {
        return discordName;
    }

    public void setDiscordName(String discordName) {
        this.discordName = discordName;
        App.getDatabase().setDiscordName(id, discordName);
    }

    public boolean hasRainbowChatNameColor() {
        return hasPermission("chat.usercolor.rainbow")
                && this.chatNameColor == -1;
    }

    public int getChatNameColor() {
        return this.chatNameColor;
    }

    public List<String> getChatNameClasses() {
        List<String> toReturn = new ArrayList<>();
        if (this.hasRainbowChatNameColor()) {
            toReturn.add("rainbow");
        }
        return toReturn.size() != 0 ? toReturn : null;
    }

    public void setChatNameColor(int colorIndex, boolean callDB) {
        this.chatNameColor = colorIndex;
        if (callDB) {
            App.getDatabase().setChatNameColor(id, colorIndex);
        }
    }

    /**
     * Attempts to get placing lock. Weak implementation of a mutex lock.
     * When placingLocked, we're in the process of placing a pixel and database tables pertaining to placements shouldn't be updated until lock is released.
     *
     * @return True if a lock was acquired, false otherwise.
     */
    public boolean tryGetPlacingLock() {
        if (placingLock.compareAndSet(false, true)) {
            return true;
        }
        return false;
    }

    public boolean isPlacingLocked() {
        return placingLock.get();
    }

    /**
     * Releases the placingLock.
     */
    public void releasePlacingLock() {
        placingLock.set(false);
    }

    /**
     * Same logic as {@link #tryGetPlacingLock()}
     * @return True if a lock was acquired, false otherwise.
     * @see #tryGetPlacingLock()
     */
    public boolean tryGetUndoLock() {
        if (undoLock.compareAndSet(false, true)) {
            return true;
        }
        return false;
    }

    public boolean isUndoLocked() {
        return undoLock.get();
    }

    public void releaseUndoLock() {
        undoLock.set(false);
    }

    public boolean isPermaChatbanned() {
        return isPermaChatbanned;
    }

    public long getChatbanExpiryTime() {
        return chatbanExpiryTime;
    }

    public String getChatbanReason() {
        return chatbanReason;
    }

    public boolean isIdled() {
        return isIdled;
    }

    public void setIdled(boolean idled) {
        isIdled = idled;
    }

    public Timestamp getSignupTime() {
        return signup_time;
    }

    public Integer getDisplayedFaction() {
        return displayedFaction;
    }

    public void setDisplayedFactionMaybe(Integer displayedFaction) {
        if (App.getDatabase().getFactionsForUID(getId()).size() == 1) {
            setDisplayedFaction(displayedFaction, true, true);
        }
    }

    public void setDisplayedFaction(Integer displayedFaction) {
        setDisplayedFaction(displayedFaction, true, true);
    }
    public void setDisplayedFaction(Integer displayedFaction, boolean hitDB, boolean broadcast) {
        this.displayedFaction = displayedFaction;
        if (hitDB) {
            App.getDatabase().setDisplayedFactionForUID(id, displayedFaction);
        }
        if (broadcast) {
            App.getServer().broadcast(new ServerChatUserUpdate(getName(), new HashMap<String, Object>() {{put("DisplayedFaction", (displayedFaction == null || displayedFaction == 0) ? "" : fetchDisplayedFaction());}}));
        }
    }

    public Faction fetchDisplayedFaction() {
        return FactionManager.getInstance().getByID(displayedFaction).orElse(null);
    }

    public void setFactionBlocked(boolean factionBlocked, boolean callDB) {
        this.factionBlocked = factionBlocked;
        if (callDB) {
            App.getDatabase().setUserFactionBlocked(id, factionBlocked);
        }
    }

    public Boolean isFactionRestricted() {
        return factionBlocked;
    }

    public static User fromDBUser(DBUser user) {
        List<Role> roles = App.getDatabase().getUserRoles(user.id);
        return new User(user.id, user.stacked, user.username, user.login, user.signup_time, user.cooldownExpiry, roles, user.pixelCount, user.pixelCountAllTime, user.banExpiry, user.shadowBanned, user.isPermaChatbanned, user.chatbanExpiry, user.chatbanReason, user.chatNameColor, user.displayedFaction, user.discordName, user.factionBlocked);
    }
}
