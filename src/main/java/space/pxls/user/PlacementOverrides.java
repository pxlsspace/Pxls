package space.pxls.user;

public class PlacementOverrides {
	private Boolean ignoreCooldown;
	private Boolean canPlaceAnyColor;
	private Boolean ignorePlacemap;

	public PlacementOverrides(boolean ignoreCooldown, boolean canPlaceAnyColor, boolean ignorePlacemap) {
			this.ignoreCooldown = ignoreCooldown;
			this.canPlaceAnyColor = canPlaceAnyColor;
			this.ignorePlacemap = ignorePlacemap;
	}

	public boolean hasIgnoreCooldown() {
			return ignoreCooldown;
	}

	public PlacementOverrides setIgnoreCooldown(boolean ignoreCooldown) {
			this.ignoreCooldown = ignoreCooldown;
			return this;
	}

	public boolean getCanPlaceAnyColor() {
			return canPlaceAnyColor;
	}

	public PlacementOverrides setCanPlaceAnyColor(boolean canPlaceAnyColor) {
			this.canPlaceAnyColor = canPlaceAnyColor;
			return this;
	}

	public boolean hasIgnorePlacemap() {
			return ignorePlacemap;
	}

	public PlacementOverrides setIgnorePlacemap(boolean ignorePlacemap) {
			this.ignorePlacemap = ignorePlacemap;
			return this;
	}
}
