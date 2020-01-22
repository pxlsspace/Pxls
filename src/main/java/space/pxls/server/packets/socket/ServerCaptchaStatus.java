package space.pxls.server.packets.socket;

public class ServerCaptchaStatus {
    public String type = "captcha_status";
    public Boolean success;

    public ServerCaptchaStatus(Boolean success) {
        this.success = success;
    }

    public String getType() {
        return type;
    }

    public Boolean getSuccess() {
        return success;
    }
}
