package space.pxls.server.packets.chat;

public class ClientChatMessage {
    public String message;
    public int replyingToId;
    public boolean replyShouldMention;

    public ClientChatMessage(String message, int replyingToId, boolean replyShouldMention) {
        this.message = message;
        this.replyingToId = replyingToId;
        this.replyShouldMention = replyShouldMention;
    }

    public String getMessage() {
        return message;
    }

    public int getReplyingToId() {
        return replyingToId;
    }

    public boolean getReplyShouldMention() {
        return replyShouldMention;
    }
}
