package space.pxls.server.packets.chat;

import java.util.List;

public class ChatMessage {
    public int id;
    public String author;
    public Long date;
    public String message_raw;
    public List<Badge> badges;
    public List<String> authorNameClass;
    public Number authorNameColor;

    public ChatMessage(int id, String author, Long date, String message_raw, List<Badge> badges, List<String> authorNameClass, Number authorNameColor) {
        this.id = id;
        this.author = author;
        this.date = date;
        this.message_raw = message_raw;
        this.badges = badges;
        this.authorNameClass = authorNameClass;
        this.authorNameColor = authorNameColor;
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
}
