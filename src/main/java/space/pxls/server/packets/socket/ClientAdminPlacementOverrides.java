package space.pxls.server.packets.socket;

public class ClientAdminPlacementOverrides {
    public final String type = "admin_placement_overrides";

    private Boolean ignoreCooldown;
    private Boolean canPlaceAnyColor;
    private Boolean ignorePlacemap;
    private Boolean ignoreEndOfCanvas;

    public ClientAdminPlacementOverrides(Boolean ignoreCooldown, Boolean canPlaceAnyColor, Boolean ignorePlacemap, Boolean ignoreEndOfCanvas) {
        this.ignoreCooldown = ignoreCooldown;
        this.canPlaceAnyColor = canPlaceAnyColor;
        this.ignorePlacemap = ignorePlacemap;
        this.ignoreEndOfCanvas = ignoreEndOfCanvas;
    }

    public Boolean hasIgnoreCooldown() {
        return ignoreCooldown;
    }

    public Boolean getCanPlaceAnyColor() {
        return canPlaceAnyColor;
    }

    public Boolean hasIgnorePlacemap() {
        return ignorePlacemap;
    }

    public Boolean hasIgnoreEndOfCanvas() {
        return ignoreEndOfCanvas;
    }
}
