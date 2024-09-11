package space.pxls.user;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.data.DBFaction;
import space.pxls.data.DBUser;
import space.pxls.data.DBUserPixelCounts;
import space.pxls.server.packets.http.UserProfile;
import space.pxls.server.packets.http.UserProfileMinimal;
import space.pxls.server.packets.http.UserProfileOther;
import space.pxls.server.packets.socket.ClientUndo;
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
    private String name;
    private String useragent;
    private List<Role> roles;
    private int pixelCount;
    private int pixelCountAllTime;
    private boolean loginWithIP;
    private PlacementOverrides placementOverrides;
    private boolean overrideCaptcha = false;
    private boolean flaggedForCaptcha = true;
    private boolean justShowedCaptcha;
    private boolean lastPlaceWasStack = false;
    private AtomicBoolean placingLock = new AtomicBoolean(false);
    private AtomicBoolean undoLock = new AtomicBoolean(false);
    private boolean isRenameRequested = false;
    private boolean isIdled = false;
    private String discordName;
    private long cooldownExpiry;
    private long lastPixelTime = 0;
    private long initialAuthTime = 0L;
    private Timestamp signup_time;
    private Integer displayedFaction;
    private Boolean factionBlocked;
    private Boolean twitchSubbed;

    private boolean shadowBanned;
    // 0 = not banned
    private Long banExpiryTime;

    private Set<WebSocketChannel> connections = new HashSet<>();

    public User(int id, int stacked, String name, Timestamp signup, long cooldownExpiry, List<Role> roles, boolean loginWithIP, int pixelCount, int pixelCountAllTime, Long banExpiryTime, boolean shadowBanned, Integer displayedFaction, String discordName, Boolean factionBlocked, Boolean twitchSubbed) {
        this.id = id;
        this.stacked = stacked;
        this.name = name;
        this.signup_time = signup;
        this.cooldownExpiry = cooldownExpiry;
        this.roles = roles;
        this.pixelCount = pixelCount;
        this.pixelCountAllTime = pixelCountAllTime;
        this.loginWithIP = loginWithIP;
        this.banExpiryTime = banExpiryTime;
        this.shadowBanned = shadowBanned;
        this.displayedFaction = displayedFaction;
        this.discordName = discordName;
        this.factionBlocked = factionBlocked;
        this.twitchSubbed = twitchSubbed;

        this.placementOverrides = new PlacementOverrides(false, false, false, false);
    }

    public void reloadFromDatabase() {
        DBUser user = App.getDatabase().getUserByID(id).orElse(null);
        if (user != null) {
            List<Role> roles = App.getDatabase().getUserRoles(user.id);
            this.id = user.id;
            this.stacked = user.stacked;
            this.name = user.username;
            this.signup_time = user.signup_time;
            this.cooldownExpiry = user.cooldownExpiry;
            this.roles = roles;
            this.banExpiryTime = user.banExpiry;
            this.isRenameRequested = user.isRenameRequested;
            this.discordName = user.discordName;
            this.displayedFaction = user.displayedFaction;
            this.factionBlocked = user.factionBlocked;
        }
    }

    public int getId() {
        return id;
    }

    public boolean canPlaceColor(int color) {
        return color >= 0 && (color < App.getPalette().getColors().size() || (color == 0xFF && placementOverrides.getCanPlaceAnyColor()));
    }

    public boolean canPlace() {
        if (isRenameRequested) return false;

        if (!hasPermission("board.place")) return false;
        if (placementOverrides.hasIgnoreCooldown()) return true;
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
        if (placementOverrides.hasIgnoreCooldown()) return 0;

        return Math.max(0, cooldownExpiry - System.currentTimeMillis()) / 1000f;
    }

    public void setOverrideCaptcha(boolean overrideCaptcha) {
        this.overrideCaptcha = overrideCaptcha;
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

    public void maybeSetIgnoreCooldown(boolean ignoreCooldown) {
        placementOverrides.setIgnoreCooldown(ignoreCooldown && (hasPermission("board.cooldown.override") || hasPermission("board.cooldown.ignore")));
    }

    public boolean hasIgnoreCooldown() {
        return placementOverrides.hasIgnoreCooldown();
    }

    public void maybeSetCanPlaceAnyColor(boolean canPlaceAnyColor) {
        placementOverrides.setCanPlaceAnyColor(canPlaceAnyColor && hasPermission("board.palette.all"));
    }

    public boolean getCanPlaceAnyColor() {
        return placementOverrides.getCanPlaceAnyColor();
    }

    public void maybeSetIgnorePlacemap(boolean ignorePlacemap) {
        placementOverrides.setIgnorePlacemap(ignorePlacemap && hasPermission("board.placemap.ignore"));
    }

    public boolean hasIgnorePlacemap() {
        return placementOverrides.hasIgnorePlacemap();
    }

    public void maybeSetIgnoreEndOfCanvas(boolean endOfCanvas) {
        placementOverrides.setIgnoreEndOfCanvas(endOfCanvas && hasPermission("board.endOfCanvas.ignore"));
    }

    public boolean hasIgnoreEndOfCanvas() {
        return placementOverrides.hasIgnoreEndOfCanvas();
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

    public List<UserLogin> getLogins() {
        return App.getDatabase().getUserLogins(id).stream()
            .map((dbLogin) -> UserLogin.fromDB(dbLogin))
            .collect(Collectors.toList());
    }

    public boolean loginsWithIP() {
        return loginWithIP;
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

    public PlacementOverrides getPlaceOverrides() {
        return placementOverrides;
    }

    public boolean isOverridingCaptcha() {
        return overrideCaptcha;
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

    public boolean isBanned() {
        return banExpiryTime != null && (banExpiryTime == 0 || banExpiryTime > System.currentTimeMillis());
    }

    public boolean isShadowBanned() {
        return shadowBanned;
    }

    public Long getBanExpiryTime() {
        return banExpiryTime;
    }

    public boolean isPermaBanned() {
        return banExpiryTime != null && banExpiryTime == 0;
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
            this.banExpiryTime = (timeFromNowSeconds*1000L) + System.currentTimeMillis();
        }
        App.getDatabase().updateBan(this, timeFromNowSeconds);
        if (!skipSendUserData) sendUserData();
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

    public void unban(User whoUnbanned, String unbanReason, boolean shouldRevert) {
        setBanExpiryTime(null);
        shadowBanned = false;
        App.getDatabase().updateUserShadowBanned(this, false);
        if (shouldRevert) {
            App.undoRollback(this);
        }
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
        int twitchBonus = App.getStackTwitchBonus();

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
                if (twitchSubbed) {
                    setStacked(Math.min(getStacked() + twitchBonus, maxStacked));
                } else {
                    setStacked(getStacked() + 1);
                }
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
            setDisplayedFaction(displayedFaction, true);
        }
    }

    public void setDisplayedFaction(Integer displayedFaction) {
        setDisplayedFaction(displayedFaction, true);
    }
    public void setDisplayedFaction(Integer displayedFaction, boolean hitDB) {
        this.displayedFaction = displayedFaction;
        if (hitDB) {
            App.getDatabase().setDisplayedFactionForUID(id, displayedFaction);
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

    public Boolean isTwitchSubbed() {
        return twitchSubbed;
    }

    public void setTwitchSubbed(boolean isTwitchSubbed) {
        App.getDatabase().setTwitchSubbed(id, isTwitchSubbed);
    }

    public static User fromDBUser(DBUser user) {
        List<Role> roles = App.getDatabase().getUserRoles(user.id);
        return new User(user.id, user.stacked, user.username, user.signup_time, user.cooldownExpiry, roles, user.loginWithIP, user.pixelCount, user.pixelCountAllTime, user.banExpiry, user.shadowBanned, user.displayedFaction, user.discordName, user.factionBlocked, user.twitchSubbed);
    }

    public UserProfile toProfile() {
        List<DBFaction> factions = App.getDatabase().getFactionsForUID(getId());
        List<ProfileFaction> profileFactions = new ArrayList<>();
        for (DBFaction dbFaction : factions) {
            String ownerName = App.getDatabase().getUserByID(dbFaction.owner).get().username;
            var optionalFaction = FactionManager.getInstance().getByID(dbFaction.id);
            if (optionalFaction.isEmpty()) {
                continue;
            }
            var members = optionalFaction.get().fetchMembersMinimal();
            var bans = optionalFaction.get().fetchBansMinimal();
            profileFactions.add(new ProfileFaction(
                    dbFaction.id,
                    dbFaction.name,
                    dbFaction.tag,
                    dbFaction.color,
                    dbFaction.owner,
                    ownerName,
                    dbFaction.canvasCode,
                    dbFaction.created.getTime(),
                    members,
                    bans
            ));
        }
        return new UserProfile(
                id,
                name,
                signup_time.getTime(),
                pixelCount,
                pixelCountAllTime,
                roles,
                displayedFaction,
                profileFactions,
                isBanned(),
                isPermaBanned(),
                banExpiryTime,
                factionBlocked,
                discordName
        );
    }

    public UserProfileMinimal toProfileMinimal() {
        return new UserProfileMinimal(
                id,
                name,
                pixelCountAllTime
        );
    }

    public UserProfileOther toProfileOther() {
        List<DBFaction> factions = App.getDatabase().getFactionsForUID(getId()).stream().filter(dbFaction -> dbFaction.id == this.displayedFaction).toList();
        List<ProfileFactionOther> profileFactions = new ArrayList<>();
        for (DBFaction dbFaction : factions) {
            String ownerName = App.getDatabase().getUserByID(dbFaction.owner).get().username;
            var optionalFaction = FactionManager.getInstance().getByID(dbFaction.id);
            if (optionalFaction.isEmpty()) {
                continue;
            }
            profileFactions.add(new ProfileFactionOther(
                    dbFaction.id,
                    dbFaction.name,
                    dbFaction.tag,
                    dbFaction.color,
                    dbFaction.owner,
                    ownerName,
                    dbFaction.canvasCode,
                    dbFaction.created.getTime()
            ));
        }
        return new UserProfileOther(
                id,
                name,
                signup_time.getTime(),
                pixelCount,
                pixelCountAllTime,
                roles,
                displayedFaction,
                profileFactions,
                isBanned(),
                isPermaBanned(),
                banExpiryTime,
                factionBlocked,
                discordName
        );
    }
}
