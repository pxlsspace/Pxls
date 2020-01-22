package space.pxls.server.packets.socket;

import java.util.Collection;

public class ServerPlace {
    public String type = "pixel";
    public Collection<Pixel> pixels;

    public ServerPlace(Collection<Pixel> pixels) {
        this.pixels = pixels;
    }

    public static class Pixel {
        Integer x;
        Integer y;
        Integer color;

        public Pixel(Integer x, Integer y, Integer color) {
            this.x = x;
            this.y = y;
            this.color = color;
        }
    }

    public String getType() {
        return type;
    }

    public Collection<Pixel> getPixels() {
        return pixels;
    }
}
