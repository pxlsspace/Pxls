package space.pxls.server.packets.socket;

public class ServerPixels {
    public String type = "pixels";
    public Integer count;
    public String cause;

    public ServerPixels(Integer count, String cause) {
        this.count = count;
        this.cause = cause;
    }

    public String getType() {
        return type;
    }

    public Integer getCount() {
        return count;
    }

    public String getCause() {
        return cause;
    }
}
