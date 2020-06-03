package space.pxls.user;

public enum Role {
    SHADOWBANNED,
    BANNED,
    GUEST,
    USER,
    DONATOR,
    TRIALMOD,
    MODERATOR,
    DEVELOPER,
    ADMIN;

    public boolean lessThan(Role other) {
        return ordinal() < other.ordinal();
    }

    public boolean greaterThan(Role other) {
        return ordinal() > other.ordinal();
    }

    public boolean lessEqual(Role other) {
        return ordinal() <= other.ordinal();
    }

    public boolean greaterEqual(Role other) {
        return ordinal() >= other.ordinal();
    }
}
