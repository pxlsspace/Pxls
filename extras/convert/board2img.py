"""
board2img.py - Convert an Pxls .dat file into a .png image
Author: Martín "Netux" Rodriguez
"""

from PIL import Image
from math import floor
from pathlib import Path
from struct import unpack


def get_config_path():
	parent = Path(__file__).parent
	config_path = None
	for i in range(2):
		parent = parent / '..'
		config_path = (parent / 'pxls.conf')
		if config_path.is_file():
			break
		else:
			config_path = None
	
	return config_path

def hex_to_rgba(h):
	if h[0] == '#':
		h = h[1:]
	
	i = int(h, 16)
	return (i >> 16 & 255, i >> 8 & 255, i & 255, 255)

if __name__ == '__main__':
	import sys

	USAGE = f'Usage: {sys.argv[0]} path/to/file.dat [mode]'
	print_err = lambda v: sys.stderr.write(str(v) + '\n')
	is_no = lambda v: v in ('n', 'no')

	if '-h' in sys.argv or '--help' in sys.argv:
		print(USAGE)
		print('\twhere mode is one of: board, placemap, heatmap, virginmap (default: board)')

	if len(sys.argv) < 2:
		print(USAGE)
		sys.exit(0)
	datafile_path = Path(sys.argv[1])
	mode = sys.argv[2] if len(sys.argv) >= 3 else 'board'

	if not datafile_path.is_file():
		print_err('Provided Data File not found')
		sys.exit(1)

	config_path = get_config_path()
	width = None
	palette = None
	default_color_idx = 0
	if config_path and not is_no(input('Use found pxls.conf? [Y/n]: ')):
		from pyhocon import ConfigFactory as HoconConfigFactory

		config = HoconConfigFactory.parse_file(config_path.absolute())
		width = config.get('board.width')
		palette = config.get('board.palette')
		default_color_idx = config.get('board.defaultColor')
	else:
		while width is None:
			try:
				width = int(input('Board width: '))
			except ValueError:
				print('Width is not an integer')
		
		import re
		from json import loads
		
		color_regex = re.compile(r'^#[a-f0-9]{6}$', re.IGNORECASE)

		if mode == 'board':
			while	palette is None:
				try:
					palette = loads(input('Palette array: '))

					if type(palette) != list or any(type(v) != str or not color_regex.match(v) for v in palette):
						palette = None
						raise Exception('Invalid array format')
					if len(palette) == 0:
						palette = None
						raise Exception('Palette must not be empty')
				except KeyboardInterrupt as kerr:
					raise kerr
				except Exception as err:
					print(f'{err.args[0]}. Array must be in the format: \'["#000000", "#FF0000", ...]\'')
	
	if palette:
		palette = [hex_to_rgba(h) for h in palette]

	datafile_size = datafile_path.stat().st_size
	height = datafile_size / width
	if height != floor(height):
		print_err("File size isn't divisible by width")
		sys.exit(1)
	height = floor(height)
	
	output = Image.new('RGBA', (width, height), color=palette[default_color_idx] if palette else 0)
	pixels = output.load()
	with datafile_path.open('rb') as datafile:
		for i in range(datafile_size):
			b = datafile.read(1)
			if b == b'':
				break

			x = i % width
			y = floor(i / width)

			if mode == 'board':
				idx = int.from_bytes(b, 'big')
				pixels[x, y] = palette[idx] if b != b'\xff' else (0, 0, 0, 0)
			elif mode == 'placemap':
				pixels[x, y] = (255, 255, 255, 255 if b == b'\xff' else 0)
			elif mode == 'heatmap':
				r = int.from_bytes(b, 'big')
				pixels[x, y] = (r, 0, 0, 255)
			elif mode == 'virginmap':
				pixels[x, y] = (0, 255 if b == b'\xff' else 0, 0, 255)
	
	default_outfile_path = datafile_path.with_suffix('.png')
	outfile_path_input = input(f'Output file [{default_outfile_path}]: ')
	outfile_path = default_outfile_path if len(outfile_path_input) == 0 else Path(outfile_path_input)

	if outfile_path.is_file():
		if is_no(input('File already exists at destination, override it? [Y/n]: ')):
			sys.exit(0)

	with outfile_path.open('wb') as outputfile:
		output.save(outputfile, 'PNG')
		print(f'Written to {outfile_path}')
