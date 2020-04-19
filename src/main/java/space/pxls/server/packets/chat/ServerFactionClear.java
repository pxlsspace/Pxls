package space.pxls.server.packets.chat;

public class ServerFactionClear {
    private String type = "faction_clear";
    private int fid;

    public ServerFactionClear(int fid) {
        this.fid = fid;
    }

    public String getType() {
        return type;
    }

    public int getFid() {
        return fid;
    }
}
