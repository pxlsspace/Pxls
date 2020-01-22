package space.pxls.server.packets.socket;

import space.pxls.data.DBNotification;

public class ServerNotification {
    public String type = "notification";
    public DBNotification notification;

    public ServerNotification(DBNotification notification) {
        this.notification = notification;
    }

    public String getType() {
        return type;
    }

    public DBNotification getNotification() {
        return notification;
    }
}
