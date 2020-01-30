package space.pxls.server.packets.socket;

public class ServerError {
    private String message;

    public ServerError(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
}
