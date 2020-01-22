package space.pxls.server.packets.http;

public class Notification {
    public Number id;
    public String title;
    public String body;
    public Long time;
    public Long expiry;
    public String who;

    public Notification(Number id, String title, String body, Long time, Long expiry, String who) {
        this.id = id;
        this.title = title;
        this.body = body;
        this.time = time;
        this.expiry = expiry;
        this.who = who;
    }

    public Number getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Long getTime() {
        return time;
    }

    public Long getExpiry() {
        return expiry;
    }

    public String getWho() {
        return who;
    }
}
