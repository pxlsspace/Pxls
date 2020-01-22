package space.pxls.server.packets.socket;

public class ServerUsers {
    public String type = "users";
    public Integer count;

    public ServerUsers(Integer count) {
        this.count = count;
    }

    public String getType() {
        return type;
    }

    public Integer getCount() {
        return count;
    }
}
