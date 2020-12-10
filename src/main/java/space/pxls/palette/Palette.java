package space.pxls.palette;

import java.util.List;

public class Palette {
	protected List<Color> colors;
	protected byte defaultColorIndex;

	public Palette(List<Color> colors, byte defaultColorIndex) {
		this.colors = colors;
		this.defaultColorIndex = defaultColorIndex;
	}

	public List<Color> getColors() {
		return colors;
	}

	public byte getDefaultColorIndex() {
		return defaultColorIndex;
	}
}
