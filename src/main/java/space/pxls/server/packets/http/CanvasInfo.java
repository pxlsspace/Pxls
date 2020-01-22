package space.pxls.server.packets.http;

import space.pxls.auth.AuthService;

import java.util.List;
import java.util.Map;

public class CanvasInfo {
    public String canvasCode;
    public Integer width;
    public Integer height;
    public List<String> palette;
    public String captchaKey;
    public Integer heatmapCooldown;
    public Integer maxStacked;
    public Map<String, AuthService> authServices;
    public Boolean registrationEnabled;
    public Integer chatCharacterLimit;

    public CanvasInfo(String canvasCode, Integer width, Integer height, List<String> palette, String captchaKey, Integer heatmapCooldown, Integer maxStacked, Map<String, AuthService> authServices, Boolean registrationEnabled, Integer chatCharacterLimit) {
        this.canvasCode = canvasCode;
        this.width = width;
        this.height = height;
        this.palette = palette;
        this.captchaKey = captchaKey;
        this.heatmapCooldown = heatmapCooldown;
        this.maxStacked = maxStacked;
        this.authServices = authServices;
        this.registrationEnabled = registrationEnabled;
        this.chatCharacterLimit = chatCharacterLimit;
    }

    public String getCanvasCode() {
        return canvasCode;
    }

    public Integer getWidth() {
        return width;
    }

    public Integer getHeight() {
        return height;
    }

    public List<String> getPalette() {
        return palette;
    }

    public String getCaptchaKey() {
        return captchaKey;
    }

    public Integer getHeatmapCooldown() {
        return heatmapCooldown;
    }

    public Integer getMaxStacked() {
        return maxStacked;
    }

    public Map<String, AuthService> getAuthServices() {
        return authServices;
    }

    public Boolean getRegistrationEnabled() {
        return registrationEnabled;
    }

    public Integer getChatCharacterLimit() {
        return chatCharacterLimit;
    }
}
