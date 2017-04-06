package space.pxls;

import java.util.List;

public class Data {
    public static class ClientPlace {
        int x;
        int y;
        int color;
    }

    public static class ClientCaptcha {
        String token;
    }


    public static class ClientSetCooldownOverride {
        boolean override;
    }

    public static class ServerPlace {
        String type = "pixel";
        int x;
        int y;
        int color;

        public ServerPlace(int x, int y, int color) {
            this.x = x;
            this.y = y;
            this.color = color;
        }
    }

    public static class ServerAlert {
        String type = "alert";
        String message;

        public ServerAlert(String message) {
            this.message = message;
        }
    }

    public static class ServerUsers {
        String type = "users";
        int count;

        public ServerUsers(int count) {
            this.count = count;
        }
    }

    public static class ServerCaptchaNeeded {
        String type = "captcha_required";
    }

    public static class ServerCaptchaStatus {
        String type = "captcha_status";
        boolean success;

        public ServerCaptchaStatus(boolean success) {
            this.success = success;
        }
    }

    public static class ServerCooldown {
        String type = "cooldown";
        float wait;

        public ServerCooldown(float wait) {
            this.wait = wait;
        }
    }

    public static class BoardInfo {
        int width;
        int height;
        List<String> palette;

        public BoardInfo(int width, int height, List<String> palette) {
            this.width = width;
            this.height = height;
            this.palette = palette;
        }
    }
}
