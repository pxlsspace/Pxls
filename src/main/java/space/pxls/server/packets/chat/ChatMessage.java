package space.pxls.server.packets.chat;

import space.pxls.user.Faction;
import space.pxls.user.User;
import space.pxls.App;

import java.util.List;

public class ChatMessage {
    public int id;
    public String author;
    public Long date;
    public String message_raw;
    public int replyingToId;
    public Boolean replyShouldMention;
    public Purge purge;
    public List<Badge> badges;
    public List<String> authorNameClass;
    public Number authorNameColor;
    public Boolean authorWasShadowBanned;
    public StrippedFaction strippedFaction;

    public ChatMessage(int id, String author, Long date, String message_raw, int replyingToId, boolean replyShouldMention, Purge purge, List<Badge> badges, List<String> authorNameClass, Number authorNameColor, Boolean authorWasShadowBanned, Faction faction) {
        this.id = id;
        this.author = author;
        this.date = date;
        this.message_raw = message_raw;
        this.replyingToId = replyingToId;
        // set replyShouldMention to null when false so that it is skipped by Gson
        this.replyShouldMention = replyShouldMention ? true : null;
        this.purge = purge;
        this.badges = badges;
        this.authorNameClass = authorNameClass;
        this.authorNameColor = authorNameColor;
        // set authorIsShadowBanned to null when false so that it is skipped by Gson
        this.authorWasShadowBanned = authorWasShadowBanned ? true : null;
        this.strippedFaction = faction != null ? new StrippedFaction(faction) : null;
    }

    public int getId() {
        return id;
    }

    public String getAuthor() {
        return author;
    }

    public Long getDate() {
        return date;
    }

    public String getMessage_raw() {
        return message_raw;
    }
    
    public int getReplyingToId() {
        return replyingToId;
    }

    public boolean getReplyShouldMention() {
        return replyShouldMention;
    }

    public List<Badge> getBadges() {
        return badges;
    }

    public List<String> getAuthorNameClass() {
        return authorNameClass;
    }

    public Number getAuthorNameColor() {
        return authorNameColor;
    }

    public boolean getAuthorWasShadowBanned() {
        return authorWasShadowBanned != null && authorWasShadowBanned;
    }

    public StrippedFaction getStrippedFaction() {
        return strippedFaction;
    }

    public ChatMessage asSnipRedacted() {
        // Redact username.
        return new ChatMessage(id, "-snip-", date, message_raw, replyingToId, replyShouldMention, purge, badges, authorNameClass, authorNameColor, authorWasShadowBanned != null, null);
    }

    public ChatMessage asShadowBanned() {
        // Hide the fact that the user is shadow banned.
        return new ChatMessage(id, author, date, message_raw, replyingToId, replyShouldMention, purge, badges, authorNameClass, authorNameColor, false, null);
    }

    public static class StrippedFaction {
        private int id;
        private String name;
        private String tag;
        private int color;

        public StrippedFaction(Faction f) {
            this.id = f.getId();
            this.name = f.getName();
            this.tag = f.getTag();
            this.color = f.getColor();
        }

        public String getName() {
            return name;
        }

        public String getTag() {
            return tag;
        }
    }

    public static class Purge {
        private final String initiator;
        private final String reason;

        public Purge(Integer initiatorUID, String reason) {
            final User purger = App.getUserManager().getByID(initiatorUID);
            this.initiator = purger == null ? "<console>" : purger.getName();
            this.reason = reason;
        }

        public String getInitiator() {
            return initiator;
        }

        public String getReason() {
            return reason;
        }
    }
}
