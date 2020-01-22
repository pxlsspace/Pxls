package space.pxls.server.packets.socket;

public class ClientPlaceMaybe {
    public Integer x;
    public Integer y;
    public Integer color;

    public ClientPlaceMaybe(Integer x, Integer y, Integer color) {
        this.x = x;
        this.y = y;
        this.color = color;
    }

    public Integer getX() {
        return x;
    }

    public Integer getY() {
        return y;
    }

    public Integer getColor() {
        return color;
    }
}
