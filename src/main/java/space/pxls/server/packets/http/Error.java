package space.pxls.server.packets.http;

public class Error {
    public String error;
    public String message;

    public Error(String error, String message) {
        this.error = error;
        this.message = message;
    }

    public String getError() {
        return error;
    }

    public String getMessage() {
        return message;
    }
}
