package space.pxls.user;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.data.DBUser;
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

public class User {
    private int id;
    private int stacked;
    private int chatNameColor;
    private String name;
    private String login;
    private String useragent;

    private Role role;
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
    private long lastUndoTime = 0;
    private long initialAuthTime = 0L;
    private Timestamp signup_time;
    private Integer displayedFaction;
    private Boolean factionBlocked;

    // 0 = not banned
    private long banExpiryTime;
    private long chatbanExpiryTime;

    private Set<WebSocketChannel> connections = new HashSet<>();

    public User(int id, int stacked, String name, String login, Timestamp signup, long cooldownExpiry, Role role, long banExpiryTime, boolean isPermaChatbanned, long chatbanExpiryTime, String chatbanReason, int chatNameColor, Integer displayedFaction, String discordName, Boolean factionBlocked) {
        this.id = id;
        this.stacked = stacked;
        this.name = name;
        this.login = login;
        this.signup_time = signup;
        this.cooldownExpiry = cooldownExpiry;
        this.role = role;
        this.banExpiryTime = banExpiryTime;
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
            this.id = user.id;
            this.stacked = user.stacked;
            this.name = user.username;
            this.login = user.login;
            this.signup_time = user.signup_time;
            this.cooldownExpiry = user.cooldownExpiry;
            this.role = user.role;
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
        if (role.greaterEqual(Role.MODERATOR) && overrideCooldown) return true;
        if (!role.greaterEqual(Role.USER) && role != Role.SHADOWBANNED) return false; // shadowbanned seems to be able to place
        return cooldownExpiry < System.currentTimeMillis();
    }

    public boolean undoWindowPassed() {
        return lastPixelTime + App.getConfig().getDuration("undo.window", TimeUnit.MILLISECONDS) < System.currentTimeMillis();
    }

    public boolean canUndo() {
        return canUndo(true);
    }
    public boolean canUndo(boolean hitBucket) {
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

    public void setLastUndoTime() {
        lastUndoTime = System.currentTimeMillis();
    }

    public float getRemainingCooldown() {
        if (role.greaterEqual(Role.MODERATOR) && overrideCooldown) return 0;

        return Math.max(0, cooldownExpiry - System.currentTimeMillis()) / 1000f;
    }

    public boolean updateCaptchaFlagPrePlace() {
        if (role.greaterThan(Role.USER)) {
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
        this.overrideCooldown = overrideCooldown;
        if (role.lessThan(Role.MODERATOR)) this.overrideCooldown = false;
    }

    public Role getRole() {
        return role;
    }

    public String getLogin() {
        return login;
    }

    private void sendUserData() {
        for (WebSocketChannel ch : connections) {
            App.getServer().getPacketHandler().userdata(ch, this);
        }
    }

    public void setRole(Role role) {
        setRole(role, false);
    }
    public void setRole(Role role, boolean skipSendUserData) {
        this.role = role;
        App.getDatabase().setUserRole(this, role);
        if (!skipSendUserData && role != Role.SHADOWBANNED) {
            sendUserData();
        }
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
        if (role.greaterEqual(Role.MODERATOR)) return overrideCooldown;
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

        if (getRole() != null && getRole().greaterEqual(Role.TRIALMOD)) {
            if (getRole().equals(Role.DEVELOPER)) {
                toReturn.add(new Badge("Developer", "Developer", "icon", "fas fa-wrench"));
            } else if (getRole().greaterEqual(Role.TRIALMOD)) {
                String roleName = getRole().name().toLowerCase();
                roleName = Character.toUpperCase(roleName.charAt(0)) + roleName.substring(1);
                toReturn.add(new Badge(roleName, roleName, "icon", "fas fa-shield-alt"));
            }
        }

        if (!App.getConfig().getBoolean("oauth.snipMode")) {
            int _count = getPixelsAllTime();
            if (_count >= 1000000) {
                toReturn.add(new Badge("1m+", "1m+ Pixels Placed", "text", null));
            } else if (_count >= 900000) {
                toReturn.add(new Badge("900k+", "900k+ Pixels Placed", "text", null));
            } else if (_count >= 800000) {
                toReturn.add(new Badge("800k+", "800k+ Pixels Placed", "text", null));
            } else if (_count >= 700000) {
                toReturn.add(new Badge("700k+", "700k+ Pixels Placed", "text", null));
            } else if (_count >= 600000) {
                toReturn.add(new Badge("600k+", "600k+ Pixels Placed", "text", null));
            } else if (_count >= 500000) {
                toReturn.add(new Badge("500k+", "500k+ Pixels Placed", "text", null));
            } else if (_count >= 400000) {
                toReturn.add(new Badge("400k+", "400k+ Pixels Placed", "text", null));
            } else if (_count >= 300000) {
                toReturn.add(new Badge("300k+", "300k+ Pixels Placed", "text", null));
            } else if (_count >= 200000) {
                toReturn.add(new Badge("200k+", "200k+ Pixels Placed", "text", null));
            } else if (_count >= 100000) {
                toReturn.add(new Badge("100k+", "100k+ Pixels Placed", "text", null));
            } else if (_count >= 50000) {
                toReturn.add(new Badge("50k+", "50k+ Pixels Placed", "text", null));
            } else if (_count >= 25000) {
                toReturn.add(new Badge("25k+", "25k+ Pixels Placed", "text", null));
            } else if (_count >= 10000) {
                toReturn.add(new Badge("10k+", "10k+ Pixels Placed", "text", null));
            } else if (_count >= 5000) {
                toReturn.add(new Badge("5k+", "5k+ Pixels Placed", "text", null));
            } else if (_count >= 1000) {
                toReturn.add(new Badge("1k+", "1k+ Pixels Placed", "text", null));
            } else {
                toReturn.add(new Badge("<1k", "<1k Pixels Placed", "text", null));
            }
        }

        return toReturn;
    }

    public boolean isPermaBanned() {
        return this.role == Role.BANNED;
    }

    public boolean isShadowBanned() {
        return this.role == Role.SHADOWBANNED;
    }

    public boolean isBanned() {
        return banExpiryTime > System.currentTimeMillis() || role == Role.BANNED; // shadowbans are hidden....
    }

    public long getBanExpiryTime() {
        return banExpiryTime;
    }

    private void setBanExpiryTime(long timeFromNowSeconds, boolean skipSendUserData) {
        this.banExpiryTime = (timeFromNowSeconds*1000) + System.currentTimeMillis();
        App.getDatabase().updateBan(this, timeFromNowSeconds);
        if (!skipSendUserData && role != Role.SHADOWBANNED) {
            sendUserData();
        }
    }
    private void setBanExpiryTime(long timeFromNowSeconds) {
        setBanExpiryTime(timeFromNowSeconds, false);
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

    public void shadowban(String reason, int rollbackTime, User banner) {
        setBanReason(reason);
        setRole(Role.SHADOWBANNED, true);
        App.rollbackAfterBan(this, rollbackTime);
        App.getDatabase().insertBanLog(banner == null ? 0 : banner.getId(), this.getId(), System.currentTimeMillis(), 0L, "shadowban", reason);
    }

    public void shadowban(String reason, User banner) {
        shadowban(reason, 24*3600, banner);
    }

    public void shadowban(User banner) {
        shadowban("", banner);
    }

    public void ban(long timeFromNowSeconds, String reason, int rollbackTime, User banner) {
        setBanExpiryTime(timeFromNowSeconds, true);
        setBanReason(reason);
        sendUserData();
        App.rollbackAfterBan(this, rollbackTime);
        long now = System.currentTimeMillis();
        App.getDatabase().insertBanLog(banner == null ? 0 : banner.getId(), this.getId(), now, now + (timeFromNowSeconds * 1000), "ban", reason);
    }

    public void ban(long timeFromNowSeconds, String reason, User banner) {
        ban(timeFromNowSeconds, reason, 0, banner);
    }

    public void ban(long timeFromNowSeconds, User banner) {
        ban(timeFromNowSeconds, "", banner);
    }

    public void permaban(String reason, int rollbackTime, User banner) {
        setBanReason(reason);
        setRole(Role.BANNED, true);
        sendUserData();
        App.rollbackAfterBan(this, rollbackTime);
        long now = System.currentTimeMillis();
        App.getDatabase().insertBanLog(banner == null ? 0 : banner.getId(), this.getId(), now, 0L, "permaban", reason);
    }

    public void permaban(String reason, User banner) {
        permaban(reason, 24*3600, banner);
    }

    public void permaban(User banner) {
        permaban("", banner);
    }

    public void unban(User whoUnbanned, String unbanReason) {
        setBanExpiryTime(0, true);
        if (role.lessThan(Role.USER)) {
            setRole(Role.USER, true);
        }
        sendUserData();
        App.undoRollback(this);
        long now = System.currentTimeMillis();
        App.getDatabase().insertBanLog(whoUnbanned == null ? 0 : whoUnbanned.getId(), this.getId(), now, 0L, "unban", unbanReason);
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

    public int getPixels() {
        return App.getDatabase().getUserPixels(this.id);
    }

    public int getPixelsAllTime() {
        return App.getDatabase().getPixelsAllTime(this.id);
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
        return App.getConfig().getBoolean("chat.staffRainbow")
                && role.greaterEqual(Role.TRIALMOD)
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
        return new User(user.id, user.stacked, user.username, user.login, user.signup_time, user.cooldownExpiry, user.role, user.banExpiry, user.isPermaChatbanned, user.chatbanExpiry, user.chatbanReason, user.chatNameColor, user.displayedFaction, user.discordName, user.factionBlocked);
    }
}
