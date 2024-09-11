package space.pxls.server.packets.http;

import com.typesafe.config.ConfigObject;
import space.pxls.auth.AuthService;
import space.pxls.palette.Color;

import java.util.List;
import java.util.Map;

public class CanvasInfo {
    public String canvasCode;
    public Integer width;
    public Integer height;
    public List<Color> palette;
    public Boolean endOfCanvas;
    public CooldownInfo cooldownInfo;
    public String captchaKey;
    public Integer heatmapCooldown;
    public Integer maxStacked;
    public Integer twitchBonus;
    public Map<String, AuthService> authServices;
    public Boolean registrationEnabled;
    public Boolean snipMode;
    public String corsBase;
    public String corsParam;
    public LegalInfo legal;

    public CanvasInfo(String canvasCode, Integer width, Integer height, List<Color> palette, Boolean endOfCanvas, CooldownInfo cooldownInfo, String captchaKey, Integer heatmapCooldown, Integer maxStacked, Integer twitchBonus, Map<String, AuthService> authServices, Boolean registrationEnabled, boolean snipMode, String corsBase, String corsParam, LegalInfo legal) {
        this.canvasCode = canvasCode;
        this.width = width;
        this.height = height;
        this.palette = palette;
        this.endOfCanvas = endOfCanvas;
        this.cooldownInfo = cooldownInfo;
        this.captchaKey = captchaKey;
        this.heatmapCooldown = heatmapCooldown;
        this.maxStacked = maxStacked;
        this.twitchBonus = twitchBonus;
        this.authServices = authServices;
        this.registrationEnabled = registrationEnabled;
        this.snipMode = snipMode;
        this.corsBase = corsBase;
        this.corsParam = corsParam;
        this.legal = legal;
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

    public List<Color> getPalette() {
        return palette;
    }

    public Boolean getEndOfCanvas() {
        return endOfCanvas;
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

    public Integer getTwitchBonus() {
        return twitchBonus;
    }

    public Map<String, AuthService> getAuthServices() {
        return authServices;
    }

    public Boolean getRegistrationEnabled() {
        return registrationEnabled;
    }

    public Boolean getSnipMode() {
        return snipMode;
    }

    public String getCorsBase() {
        return corsBase;
    }

    public String getCorsParam() {
        return corsParam;
    }

    public record LegalInfo(String termsUrl, String privacyUrl) {}

    public record CooldownInfo(String type, long staticCooldownSeconds, Map<String, Object> activityCooldown) {}
}
