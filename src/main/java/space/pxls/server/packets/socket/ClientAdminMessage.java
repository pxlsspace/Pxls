package space.pxls.server.packets.socket;

public class ClientAdminMessage {
    public String username;
    public String message;

    public ClientAdminMessage(String username, String message) {
        this.username = username;
        this.message = message;
    }

    public String getUsername() {
        return username;
    }

    public String getMessage() {
        return message;
    }
}
