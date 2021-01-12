package space.pxls.server.packets.socket;

public class ClientAdminPlacementOverrides {
    public final String type = "admin_placement_overrides";

    private Boolean ignoreCooldown;
    private Boolean canPlaceAnyColor;
    private Boolean ignorePlacemap;

    public ClientAdminPlacementOverrides(Boolean ignoreCooldown, Boolean canPlaceAnyColor, Boolean ignorePlacemap) {
        this.ignoreCooldown = ignoreCooldown;
        this.canPlaceAnyColor = canPlaceAnyColor;
        this.ignorePlacemap = ignorePlacemap;
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
}
