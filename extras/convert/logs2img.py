import argparse
import re
from datetime import datetime
from pathlib import Path
from PIL import Image
from pyhocon import ConfigFactory

HEX_COLOR_REGEX = re.compile(r'^#[a-f0-9]{6}$', re.IGNORECASE)
LOGS_TIME_FORMAT = '%Y-%m-%d %H:%M:%S,%f'


def hex_to_rgb(h):
    if h[0] == '#':
        h = h[1:]
    i = int(h, 16)
    return (i >> 16 & 255, i >> 8 & 255, i & 255)


def parse_logs_time(s):
    return datetime.strptime(s + '000', LOGS_TIME_FORMAT)


def read_config(path):
    config = ConfigFactory.parse_file(path.absolute())
    canvas_width = config.get('board.width')
    canvas_height = config.get('board.height')
    hex_palette = config.get('board.palette')
    default_color_idx = config.get('board.defaultColor')
    return canvas_width, canvas_height, hex_palette, default_color_idx


def main(logs_path, config_path, output_path, user_filter, scale):
    # Read canvas configuration
    canvas_width, canvas_height, hex_palette, default_color_idx = read_config(config_path)
    default_color = hex_to_rgb(hex_palette[default_color_idx])

    # Create a blank image with the default color
    image = Image.new('RGB', (canvas_width, canvas_height), color=default_color)
    pixels = image.load()

    # Process the log file
    with logs_path.open('r') as logs_file:
        for line in logs_file:
            line = line.rstrip('\n')
            split = line.split('\t')

            if len(split) != 7:
                continue  # Skip invalid lines

            timestamp, uid, username, x, y, color_idx, action = split
            x = int(x)
            y = int(y)
            color_idx = int(color_idx)

            # Check if username is in the whitelist (if provided)
            if user_filter is not None and username not in user_filter:
                continue

            # Set the pixel color from the log
            color = hex_to_rgb(hex_palette[color_idx])
            pixels[x, y] = color

    # Resize the image based on scale, if needed
    if scale > 1:
        image = image.resize((canvas_width * scale, canvas_height * scale), Image.NEAREST)

    # Save the final image
    image.save(output_path, format='PNG')
    print(f"Saved final image to {output_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate final image from log file")
    parser.add_argument('logs_path', help='Path to the log file', type=Path)
    parser.add_argument('config_path', help='Path to the HOCON config file', type=Path)
    parser.add_argument('output_path', help='Output PNG file path', type=Path)
    parser.add_argument('--user-filter', help='list of users to filter in', type=str, nargs='+', default=None)
    parser.add_argument('--scale', help='Scaling factor for the output image', type=int, default=1)

    args = parser.parse_args()

    main(args.logs_path, args.config_path, args.output_path, args.user_filter, args.scale)
