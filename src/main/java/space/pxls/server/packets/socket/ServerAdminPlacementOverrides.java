package space.pxls.server.packets.socket;

import space.pxls.user.PlacementOverrides;

public class ServerAdminPlacementOverrides {
    public final String type = "admin_placement_overrides";

    private PlacementOverrides placementOverrides;

    public ServerAdminPlacementOverrides(PlacementOverrides placementOverrides) {
        this.placementOverrides = placementOverrides;
    }

    public PlacementOverrides getPlacementOverrides() {
        return placementOverrides;
    }
}
