package space.pxls.user;

public class Chatban {
    public final User target;
    public final User initiator;
    public final Type type;
    public final long expiryTimeMS;
    public final String reason;
    public final boolean purge;
    public final int purgeAmount;
    public final long instantiatedMS;
    public final boolean announce;
    private Chatban(User target, User initiator, Type type, long expiryTimeMS, String reason, boolean purge, int purgeAmount, boolean announce) {
        //assert target != null
        instantiatedMS = System.currentTimeMillis();
        this.target = target;
        this.initiator = initiator;
        this.type = type;
        this.expiryTimeMS = expiryTimeMS;
        this.reason = reason;
        this.purge = purge;
        this.purgeAmount = purgeAmount;
        this.announce = announce;
    }

    /**
     * @param target      The {@link User} who is being banned
     * @param initiator   The {@link User} who is doing the ban (or NULL for console)
     * @param reason      The reason for the ban
     * @param purge       Whether or not to purge messages from chat
     * @param purgeAmount The amount of messages to purge.
     * @return A {@link Chatban} object denoting this user should be permanently banned
     */
    public static Chatban PERMA(User target, User initiator, String reason, boolean purge, int purgeAmount, boolean announce) {
        return new Chatban(target, initiator, Type.PERMA, 5000000L, reason, purge, purgeAmount, announce);
    }

    /**
     * @param target        The {@link User} who is being banned
     * @param initiator     The {@link User} who is doing the ban (or NULL for console)
     * @param chatbanExpiry The timestamp in MS of when the chatban expires
     * @param reason        The reason for the ban
     * @param purge         Whether or not to purge messages from chat
     * @param purgeAmount   The amount of messages to purge.
     * @return A {@link Chatban} object denoting this user should be temporarily banned
     */
    public static Chatban TEMP(User target, User initiator, long chatbanExpiry, String reason, boolean purge, int purgeAmount, boolean announce) {
        return new Chatban(target, initiator, Type.TEMP, chatbanExpiry, reason, purge, purgeAmount, announce);
    }

    /**
     * @param target    The {@link User} who is being banned
     * @param initiator The {@link User} who is doing the ban (or NULL for console)
     * @param reason    The reason for the ban
     * @return A {@link Chatban} object denoting this user should be unbanned
     */
    public static Chatban UNBAN(User target, User initiator, String reason) {
        return new Chatban(target, initiator, Type.UNBAN, System.currentTimeMillis(), reason, false, 0, false);
    }

    public void commit() {
        commit(true);
    }

    public void commit(boolean doLog) {
        target.chatban(this, doLog);
    }

    @Override
    public String toString() {
        return String.format("(chatban) %s: {Target: %s} {Initiator: %s} {Length: %s} {Purge: %s} {PurgeAmount: %s} {Reason: %s}", type.toString().toUpperCase(), target.getName(), initiator == null ? "CONSOLE" : initiator.getName(), type == Type.PERMA ? "Perma" : expiryTimeMS - System.currentTimeMillis(), purge, purgeAmount, reason);
    }

    public enum Type {
        TEMP,
        PERMA,
        UNBAN
    }
}
