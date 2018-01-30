package space.pxls.user;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class User {
    private int id;
    private int stacked = 0;
    private String name;
    private String login;
    private String useragent;

    private Role role = Role.USER;
    private boolean overrideCooldown;
    private boolean flaggedForCaptcha = true;
    private boolean justShowedCaptcha;
    private boolean lastPlaceWasStack = false;
    private long cooldownExpiry;
    private long lastPixelTime = 0;
    private long lastUndoTime = 0;
    private long initialAuthTime = 0L;

    // 0 = not banned
    private long banExpiryTime;

    private Set<WebSocketChannel> connections = new HashSet<>();

    public User(int id, int stacked, String name, String login, long cooldownExpiry, Role role, long banExpiryTime) {
        this.id = id;
        this.stacked = stacked;
        this.name = name;
        this.login = login;
        this.cooldownExpiry = cooldownExpiry;
        this.role = role;
        this.banExpiryTime = banExpiryTime;
    }

    public int getId() {
        return id;
    }

    public boolean canPlace() {
        if (role.greaterEqual(Role.MODERATOR) && overrideCooldown) return true;
        if (!role.greaterEqual(Role.USER) && role != Role.SHADOWBANNED) return false; // shadowbanned seems to be able to place
        return cooldownExpiry < System.currentTimeMillis();
    }

    public boolean canUndoNow() {
        return canUndo() && (lastPixelTime + App.getConfig().getDuration("undo.window", TimeUnit.MILLISECONDS) > System.currentTimeMillis());
    }

    public boolean canUndo() {
        return lastUndoTime + App.getConfig().getDuration("undo.cooldown", TimeUnit.MILLISECONDS) < System.currentTimeMillis();
    }

    public void setLastPixelTime() {
        lastPixelTime = System.currentTimeMillis();
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
        if (justShowedCaptcha) {
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
        this.role = role;
        App.getDatabase().setUserRole(this, role);
        if (role != Role.SHADOWBANNED) {
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
        return overrideCooldown;
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

    public boolean isShadowBanned() {
        return this.role == Role.SHADOWBANNED;
    }

    public boolean isBanned() {
        return banExpiryTime > System.currentTimeMillis() || role == Role.BANNED; // shadowbans are hidden....
    }

    public long getBanExpiryTime() {
        return banExpiryTime;
    }

    private void setBanExpiryTime(long timeFromNowSeconds) {
        this.banExpiryTime = (timeFromNowSeconds*1000) + System.currentTimeMillis();
        App.getDatabase().updateBan(this, timeFromNowSeconds);
        if (role != Role.SHADOWBANNED) {
            sendUserData();
        }
    }

    public Set<WebSocketChannel> getConnections() {
        return connections;
    }

    public void shadowban(String reason, int rollbackTime) {
        setBanReason(reason);
        setRole(role.SHADOWBANNED);
        App.rollbackAfterBan(this, rollbackTime);
    }

    public void shadowban(String reason) {
        shadowban(reason, 24*3600);
    }

    public void shadowban() {
        shadowban("");
    }

    public void ban(long timeFromNowSeconds, String reason, int rollbackTime) {
        setBanExpiryTime(timeFromNowSeconds);
        setBanReason(reason);
        sendUserData();
        App.rollbackAfterBan(this, rollbackTime);
    }

    public void ban(long timeFromNowSeconds, String reason) {
        ban(timeFromNowSeconds, reason, 0);
    }

    public void ban(long timeFromNowSeconds) {
        ban(timeFromNowSeconds, "");
    }

    public void permaban(String reason, int rollbackTime) {
        setBanReason(reason);
        setRole(role.BANNED);
        App.rollbackAfterBan(this, rollbackTime);
    }

    public void permaban(String reason) {
        permaban(reason, 24*3600);
    }

    public void permaban() {
        permaban("");
    }

    public void unban() {
        setBanExpiryTime(0);
        if (role.lessThan(Role.USER)) {
            setRole(Role.USER);
        }
        sendUserData();
        App.undoRollback(this);
    }

    public void setUseragent(String s) {
        useragent = s;
        App.getDatabase().updateUseragent(this, s);
    }

    public String getUseragent() {
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

    public boolean tickStack() {
        return tickStack(true);
    }

    public boolean tickStack(boolean sendRes) {
        int multiplier = App.getStackMultiplier();
        int maxStacked = App.getStackMaxStacked();
        
        int curCD = App.getServer().getPacketHandler().getCooldown();
        
        long lastPixelTime = this.lastPixelTime == 0 ? (this.cooldownExpiry == 0 ? initialAuthTime : (this.cooldownExpiry - curCD*1000)) : this.lastPixelTime;
        long delta = (Instant.now().toEpochMilli()-lastPixelTime) / 1000;
        int target = (curCD * multiplier) * (1 + getStacked());
        if (lastPixelTime > 0 && delta >= target) {
            if (getStacked() < maxStacked) {
                setStacked(getStacked() + 1);
                if (sendRes) {
                    App.getServer().getPacketHandler().sendStackedCount(this, "gain");
                }
                return true;
            }
        }
        return false;
    }
}
