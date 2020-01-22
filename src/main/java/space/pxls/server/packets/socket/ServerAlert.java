package space.pxls.server.packets.socket;

public class ServerAlert {
    public String type = "alert";
    public String message;

    public ServerAlert(String message) {
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public String getMessage() {
        return message;
    }
}
