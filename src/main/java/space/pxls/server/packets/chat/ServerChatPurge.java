package space.pxls.server.packets.chat;

public class ServerChatPurge {
    public String type = "chat_purge";
    public String target;
    public String initiator;
    public Integer amount;
    public String reason;
    public boolean announce;

    public ServerChatPurge(String target, String initiator, Integer amount, String reason, boolean announce) {
        this.target = target;
        this.initiator = initiator;
        this.amount = amount;
        this.reason = reason;
        this.announce = announce;
    }

    public String getType() {
        return type;
    }

    public String getTarget() {
        return target;
    }

    public String getInitiator() {
        return initiator;
    }

    public Integer getAmount() {
        return amount;
    }

    public String getReason() {
        return reason;
    }

    public boolean shouldAnnounce() {
        return announce;
    }

    public ServerChatPurge asSnipRedacted() {
        return new ServerChatPurge("-snip-", "-snip-", this.amount, this.reason, this.announce);
    }
}
