package space.pxls.server.packets.chat;

import java.util.List;

public class ServerChatSpecificPurge {
    public String type = "chat_purge_specific";
    public String target;
    public String initiator;
    public List<String> nonces;
    public String reason;

    public ServerChatSpecificPurge(String target, String initiator, List<String> nonces, String reason) {
        this.target = target;
        this.initiator = initiator;
        this.nonces = nonces;
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

    public List<String> getNonces() {
        return nonces;
    }

    public String getReason() {
        return reason;
    }
}
