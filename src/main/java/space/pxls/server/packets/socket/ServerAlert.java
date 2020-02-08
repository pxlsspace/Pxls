package space.pxls.server.packets.socket;

public class ServerAlert {
    public String type = "alert";
    public String message;
    public String sender;

    public ServerAlert(String sender, String message) {
        this.sender = sender;
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public String getSender() {
        return sender;
    }

    public String getMessage() {
        return message;
    }
}
