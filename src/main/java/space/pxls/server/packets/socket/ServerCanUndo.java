package space.pxls.server.packets.socket;

public class ServerCanUndo {
    public Long getTime() {
        return time;
    }

    public String type = "can_undo";
    public Long time;

    public ServerCanUndo(Long time) {
        this.time = time;
    }

    public String getType() {
        return type;
    }
}
