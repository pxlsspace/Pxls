package space.pxls.server;

import java.util.Collection;
import java.util.List;

public class Packet {
    public static class ClientPlace {
        public int x;
        public int y;
        public int color;
    }

    public static class ClientCaptcha {
        public String token;
    }

    public static class ClientAdminCooldownOverride {
        public boolean override;

        public ClientAdminCooldownOverride(boolean override) {
            this.override = override;
        }
    }

    public static class ServerCaptchaRequired {
        public String type = "captcha_required";
    }

    public static class ServerCaptchaStatus {
        String type = "captcha_status";
        boolean success;

        public ServerCaptchaStatus(boolean success) {
            this.success = success;
        }
    }

    public static class ServerPlace {
        public String type = "pixel";
        public Collection<Pixel> pixels;

        public ServerPlace(Collection<Pixel> pixels) {
            this.pixels = pixels;
        }

        public static class Pixel {
            public int x;
            public int y;
            public int color;

            public Pixel(int x, int y, int color) {
                this.x = x;
                this.y = y;
                this.color = color;
            }
        }
    }

    public static class ServerCooldown {
        public String type = "cooldown";

        public float wait;

        public ServerCooldown(float wait) {
            this.wait = wait;
        }
    }

    public static class ServerUsers {
        String type = "users";
        int count;

        public ServerUsers(int count) {
            this.count = count;
        }
    }

    public static class UserInfo {
        String type = "userinfo";
        String name;

        public UserInfo(String name) {
            this.name = name;
        }
    }

    public static class HttpInfo {
        public int width;
        public int height;
        public List<String> palette;
        public String captchaKey;

        public HttpInfo(int width, int height, List<String> palette, String captchaKey) {
            this.width = width;
            this.height = height;
            this.palette = palette;
            this.captchaKey = captchaKey;
        }
    }
}
