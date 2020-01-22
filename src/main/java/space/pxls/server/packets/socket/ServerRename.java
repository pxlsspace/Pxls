package space.pxls.server.packets.socket;

public class ServerRename {
    public Boolean getRequested() {
        return requested;
    }

    public String type = "rename";
    public Boolean requested;

    public ServerRename(Boolean requested) {
        this.requested = requested;
    }

    public String getType() {
        return type;
    }
}
