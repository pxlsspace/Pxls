package space.pxls.server.packets.chat;

import space.pxls.user.Faction;

import java.util.List;

public class ChatMessage {
    public String nonce;
    public String author;
    public String tag;
    public Long date;
    public String message_raw;
    public List<Badge> badges;
    public List<String> authorNameClass;
    public Number authorNameColor;
    public StrippedFaction strippedFaction;

    public ChatMessage(String nonce, String author, String tag, Long date, String message_raw, List<Badge> badges, List<String> authorNameClass, Number authorNameColor, Faction faction) {
        this.nonce = nonce;
        this.author = author;
        this.tag = tag;
        this.date = date;
        this.message_raw = message_raw;
        this.badges = badges;
        this.authorNameClass = authorNameClass;
        this.authorNameColor = authorNameColor;
        this.strippedFaction = faction != null ? new StrippedFaction(faction) : null;
    }

    public String getNonce() {
        return nonce;
    }

    public String getAuthor() {
        return author;
    }

    public String getTag() {
        return tag;
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
}
