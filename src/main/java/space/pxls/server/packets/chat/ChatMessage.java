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
    public Purge purge;
    public List<Badge> badges;
    public List<String> authorNameClass;
    public Number authorNameColor;
    public StrippedFaction strippedFaction;

    public ChatMessage(int id, String author, Long date, String message_raw, Purge purge, List<Badge> badges, List<String> authorNameClass, Number authorNameColor, Faction faction) {
        this.id = id;
        this.author = App.getConfig().getBoolean("oauth.snipMode") ? "-snip-" : author;
        this.date = date;
        this.message_raw = message_raw;
        this.purge = purge;
        this.badges = badges;
        this.authorNameClass = authorNameClass;
        this.authorNameColor = authorNameColor;
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

    public List<Badge> getBadges() {
        return badges;
    }

    public List<String> getAuthorNameClass() {
        return authorNameClass;
    }

    public Number getAuthorNameColor() {
        return authorNameColor;
    }

    public StrippedFaction getStrippedFaction() {
        return strippedFaction;
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
