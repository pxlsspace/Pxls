package space.pxls.server.packets.http;

public class WhoAmI {
    public String username;
    public Integer id;

    public WhoAmI(String username, Integer id) {
        this.username = username;
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public Integer getId() {
        return id;
    }
}
