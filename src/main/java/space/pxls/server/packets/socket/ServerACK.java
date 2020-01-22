package space.pxls.server.packets.socket;

public class ServerACK {
    public String type = "ACK";
    public String ackFor;
    public Integer x;
    public Integer y;

    public ServerACK(String ackFor, Integer x, Integer y) {
        this.ackFor = ackFor;
        this.x = x;
        this.y = y;
    }

    public String getType() {
        return type;
    }

    public String getAckFor() {
        return ackFor;
    }

    public Integer getX() {
        return x;
    }

    public Integer getY() {
        return y;
    }
}
