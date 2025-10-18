package space.pxls.server.packets.http;

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
    public Boolean chatEnabled;
    public Boolean chatRespectsCanvasBan;
    public Integer chatCharacterLimit;
    public List<String> chatBannerText;
    public Boolean snipMode;
    public String emoteSet7TV;
    public List<Object> customEmoji;
    public String corsBase;
    public String corsParam;
    public LegalInfo legal;
    public String chatRatelimitMessage;
    public Integer chatLinkMinimumPixelCount;
    public Boolean chatLinkSendToStaff;
    public Boolean chatDefaultExternalLinkPopup;

    public CanvasInfo(
        String canvasCode,
        Integer width,
        Integer height,
        List<Color> palette,
        CooldownInfo cooldownInfo,
        String captchaKey,
        Integer heatmapCooldown,
        Integer maxStacked,
        Boolean chatEnabled,
        Integer chatCharacterLimit,
        boolean chatRespectsCanvasBan,
        List<String> chatBannerText,
        boolean snipMode,
        String emoteSet7TV,
        List<Object> customEmoji,
        String corsBase,
        String corsParam,
        LegalInfo legal,
        String chatRatelimitMessage,
        Integer chatLinkMinimumPixelCount,
        boolean chatLinkSendToStaff,
        boolean chatDefaultExternalLinkPopup
    ) {
        this.canvasCode = canvasCode;
        this.width = width;
        this.height = height;
        this.palette = palette;
        this.cooldownInfo = cooldownInfo;
        this.captchaKey = captchaKey;
        this.heatmapCooldown = heatmapCooldown;
        this.maxStacked = maxStacked;
        this.chatEnabled = chatEnabled;
        this.chatCharacterLimit = chatCharacterLimit;
        this.chatRespectsCanvasBan = chatRespectsCanvasBan;
        this.chatBannerText = chatBannerText;
        this.snipMode = snipMode;
        this.emoteSet7TV = emoteSet7TV;
        this.customEmoji = customEmoji;
        this.corsBase = corsBase;
        this.corsParam = corsParam;
        this.legal = legal;
        this.chatRatelimitMessage = chatRatelimitMessage;
        this.chatLinkMinimumPixelCount = chatLinkMinimumPixelCount;
        this.chatLinkSendToStaff = chatLinkSendToStaff;
        this.chatDefaultExternalLinkPopup = chatDefaultExternalLinkPopup;
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

    public String getEmoteSet7TV() {
        return emoteSet7TV;
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
