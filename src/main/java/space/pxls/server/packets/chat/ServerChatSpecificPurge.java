package space.pxls.server.packets.chat;

import java.util.List;

public class ServerChatSpecificPurge {
    public String type = "chat_purge_specific";
    public String target;
    public String initiator;
    public List<Integer> IDs;
    public String reason;

    public ServerChatSpecificPurge(String target, String initiator, List<Integer> IDs, String reason) {
        this.target = target;
        this.initiator = initiator;
        this.IDs = IDs;
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

    public List<Integer> getIDs() {
        return IDs;
    }

    public String getReason() {
        return reason;
    }

    public ServerChatSpecificPurge asSnipRedacted() {
        return new ServerChatSpecificPurge("-snip-", "-snip-", this.IDs, this.reason);
    }
}
