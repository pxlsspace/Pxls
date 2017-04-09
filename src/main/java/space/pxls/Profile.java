package space.pxls;

public class Profile {
    public String ip;

    public Profile(String ip) {
        this.ip = ip;
    }

    public long lastPlace = System.currentTimeMillis();
    public boolean mustFillOutCaptcha;
    public boolean justCaptchaed;
    public boolean flagged;

    public Role role = Role.DEFAULT;
    public boolean overrideCooldown;
}
