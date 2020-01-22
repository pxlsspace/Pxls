package space.pxls.server.packets.chat;

public class Badge {
    public String displayName;
    public String tooltip;
    public String type;
    public String cssIcon = null;

    public Badge(String displayName, String tooltip, String type, String cssIcon) {
        this.displayName = displayName;
        this.tooltip = tooltip;
        this.type = type;
        this.cssIcon = cssIcon;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getTooltip() {
        return tooltip;
    }

    public String getType() {
        return type;
    }

    public String getCssIcon() {
        return cssIcon;
    }
}
