package space.pxls.server.packets.chat;

import space.pxls.App;

public class ServerChatPurge {
    public String type = "chat_purge";
    public String target;
    public String initiator;
    public Integer amount;
    public String reason;

    public ServerChatPurge(String target, String initiator, Integer amount, String reason) {
        this.target = App.getConfig().getBoolean("oauth.snipMode") ? "-snip-" : target;
        this.initiator = initiator;
        this.amount = amount;
        this.reason = reason;
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
}
