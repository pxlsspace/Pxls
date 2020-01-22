package space.pxls.server.packets.socket;

public class ServerCooldown {
    public Float getWait() {
        return wait;
    }

    public String type = "cooldown";
    public Float wait;

    public ServerCooldown(Float wait) {
        this.wait = wait;
    }

    public String getType() {
        return type;
    }
}
