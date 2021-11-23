package space.pxls.server.packets.http;

import space.pxls.palette.Color;

import java.util.List;

public class CanvasInfo {
    public String canvasCode;
    public Integer width;
    public Integer height;
    public List<Color> palette;
    public String captchaKey;
    public Integer heatmapCooldown;
    public Integer maxStacked;
    public Boolean registrationEnabled;
    public Boolean chatEnabled;
    public Boolean chatRespectsCanvasBan;
    public Integer chatCharacterLimit;
    public List<String> chatBannerText;
    public Boolean snipMode;
    public List<Object> customEmoji;
    public String corsBase;
    public String corsParam;
    public String chatRatelimitMessage;

    public CanvasInfo(
        String canvasCode,
        Integer width,
        Integer height,
        List<Color> palette,
        String captchaKey,
        Integer heatmapCooldown,
        Integer maxStacked,
        Boolean registrationEnabled,
        Boolean chatEnabled,
        Integer chatCharacterLimit,
        boolean chatRespectsCanvasBan,
        List<String> chatBannerText,
        boolean snipMode,
        List<Object> customEmoji,
        String corsBase,
        String corsParam,
        String chatRatelimitMessage
    ) {
        this.canvasCode = canvasCode;
        this.width = width;
        this.height = height;
        this.palette = palette;
        this.captchaKey = captchaKey;
        this.heatmapCooldown = heatmapCooldown;
        this.maxStacked = maxStacked;
        this.registrationEnabled = registrationEnabled;
        this.chatEnabled = chatEnabled;
        this.chatCharacterLimit = chatCharacterLimit;
        this.chatRespectsCanvasBan = chatRespectsCanvasBan;
        this.chatBannerText = chatBannerText;
        this.snipMode = snipMode;
        this.customEmoji = customEmoji;
        this.corsBase = corsBase;
        this.corsParam = corsParam;
        this.chatRatelimitMessage = chatRatelimitMessage;
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
}
