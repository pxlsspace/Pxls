package space.pxls.palette;

public class Color {
	private String name;
	private String value;

	public Color(String name, String value) {
		this.name = name;
		this.value = normalizeHex(value);
	}

	public String getValue() {
		return value;
	}

	public String getName() {
		return name;
	}

	public static String normalizeHex(String hex) {
		if (hex.startsWith("#")) {
			hex = hex.substring(1);
		}

		if (hex.length() == 3) {
			StringBuilder expanded = new StringBuilder();
			for (char c : hex.toCharArray()) {
				expanded.append(new char[]{ c, c });
			}
			hex = expanded.toString();
		} else if (hex.length() != 6) {
			throw new IllegalArgumentException("hex color must be 3 or 6 characters long");
		}

		return hex;
	}
}
