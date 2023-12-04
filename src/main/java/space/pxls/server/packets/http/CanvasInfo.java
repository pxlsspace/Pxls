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
    public CooldownInfo cooldownInfo;
    public String captchaKey;
    public Integer heatmapCooldown;
    public Integer maxStacked;
    public Map<String, AuthService> authServices;
    public Boolean registrationEnabled;
    public Boolean chatEnabled;
    public Boolean chatRespectsCanvasBan;
    public Integer chatCharacterLimit;
    public List<String> chatBannerText;
    public Boolean snipMode;
    public List<Object> customEmoji;
    public String corsBase;
    public String corsParam;
    public LegalInfo legal;
    public String chatRatelimitMessage;
    public Integer chatLinkMinimumPixelCount;
    public Boolean chatLinkSendToStaff;

    public CanvasInfo(String canvasCode, Integer width, Integer height, List<Color> palette, CooldownInfo cooldownInfo, String captchaKey, Integer heatmapCooldown, Integer maxStacked, Map<String, AuthService> authServices, Boolean registrationEnabled, Boolean chatEnabled, Integer chatCharacterLimit, boolean chatRespectsCanvasBan, List<String> chatBannerText, boolean snipMode, List<Object> customEmoji, String corsBase, String corsParam, LegalInfo legal, String chatRatelimitMessage, Integer chatLinkMinimumPixelCount, boolean chatLinkSendToStaff) {
        this.canvasCode = canvasCode;
        this.width = width;
        this.height = height;
        this.palette = palette;
        this.cooldownInfo = cooldownInfo;
        this.captchaKey = captchaKey;
        this.heatmapCooldown = heatmapCooldown;
        this.maxStacked = maxStacked;
        this.authServices = authServices;
        this.registrationEnabled = registrationEnabled;
        this.chatEnabled = chatEnabled;
        this.chatCharacterLimit = chatCharacterLimit;
        this.chatRespectsCanvasBan = chatRespectsCanvasBan;
        this.chatBannerText = chatBannerText;
        this.snipMode = snipMode;
        this.customEmoji = customEmoji;
        this.corsBase = corsBase;
        this.corsParam = corsParam;
        this.legal = legal;
        this.chatRatelimitMessage = chatRatelimitMessage;
        this.chatLinkMinimumPixelCount = chatLinkMinimumPixelCount;
        this.chatLinkSendToStaff = chatLinkSendToStaff;
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

    public Boolean getChatEnabled() {
        return chatEnabled;
    }

    public Integer getChatCharacterLimit() {
        return chatCharacterLimit;
    }

    public Boolean getChatRespectsCanvasBan() {
        return chatRespectsCanvasBan;
    }

    public List<String> getChatBannerText() {
        return chatBannerText;
    }

    public Boolean getSnipMode() {
        return snipMode;
    }

    public List<Object> getCustomEmoji() {
        return customEmoji;
    }

    public String getCorsBase() {
        return corsBase;
    }

    public String getCorsParam() {
        return corsParam;
    }

    public String getChatRatelimitMessage() {
        return chatRatelimitMessage;
    }

    public Integer getChatLinkMinimumPixelCount() {
        return chatLinkMinimumPixelCount;
    }

    public Boolean getChatLinkSendToStaff() {
        return chatLinkSendToStaff;
    }

    public record LegalInfo(String termsUrl, String privacyUrl) {}

    public record CooldownInfo(String type, long staticCooldownSeconds, Map<String, Object> activityCooldown) {}
}
