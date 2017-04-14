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

    public static class ClientBanMe {
    }

    public static class ClientAdminCooldownOverride {
        public boolean override;
        public ClientAdminCooldownOverride(boolean override) {
            this.override = override;
        }
    }

    public static class ClientAdminBan {
        public String username;

        public ClientAdminBan(String username) {
            this.username = username;
        }
    }

    public static class ClientAdminMessage {
        public String username;
        public String message;

        public ClientAdminMessage(String username, String message) {
            this.username = username;
            this.message = message;
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
    public static class ServerUserInfo {
        String type = "userinfo";
        String name;
        boolean banned;

        Long banExpiry;
        public ServerUserInfo(String name, boolean banned, Long banExpiry) {
            this.name = name;
            this.banned = banned;
            this.banExpiry = banExpiry;
        }

    }
    public static class ServerAlert {
        String type = "alert";
        String message;
        public ServerAlert(String message) {
            this.message = message;
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
