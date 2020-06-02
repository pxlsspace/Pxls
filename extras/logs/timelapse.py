'''
timelapse_generator.py - Create a .gif or sequence of .png files using a pixels.log
Author: Martín "Netux" Rodriguez
'''

import argparse
import re
from datetime import datetime, timedelta
from json import loads
from math import floor
from pathlib import Path

from PIL import Image


def find_config_path():
	parent = Path(__file__).parent
	config_path = None
	for i in range(4):
		config_path = (parent / 'pxls.conf')
		if config_path.is_file():
			break
		else:
			config_path = None
		parent = parent / '..'

	return config_path

HEX_COLOR_REGEX = re.compile(r'^#[a-f0-9]{6}$', re.IGNORECASE)
def hex_to_rgb(h):
	if h[0] == '#':
		h = h[1:]

	if len(h) != 6:
		if len(h) == 3:
			# duplicate each character so that h is 6 characters long
			for i in range(0, 6, 2):
				h = h[:i] + (h[i] * 2) + h[i+1:]
		else:
			raise ValueError('HEX value must be in the format #RRGGBB')

	i = int(h, 16)
	return (i >> 16 & 255, i >> 8 & 255, i & 255)

def parse_hex_arg(h):
	try:
		return hex_to_rgb(h)
	except Exception as ex:
		raise argparse.ArgumentTypeError(f'{h} is not a valid HEX value: {str(ex)}')

LOGS_TIME_FORMAT = '%Y-%m-%d %H:%M:%S,%f'
LOGS_TIME_HUMAN_READABLE = 'YYYY-MM-DD HH:MM:SS,mmm'
def parse_logs_time(s):
	return datetime.strptime(s + '000', LOGS_TIME_FORMAT)

TIMEDELTA_BIT_REGEX = re.compile(r'(\d+)([a-z]+)', re.IGNORECASE)
TIMEDELTA_ALIASES = {
		'weeks': ('w', 'week', 'weeks'),
		'days': ('d', 'day', 'days'),
		'hours': ('h', 'hour', 'hours'),
		'minutes': ('m', 'min', 'mins', 'minute', 'minutes'),
		'seconds': ('s', 'sec', 'secs', 'second', 'seconds'),
		'microseconds': ('micro', 'micros', 'microsecond', 'microseconds'),
		'milliseconds': ('ms', 'milli', 'millis', 'millisecond', 'milliseconds')
}
def parse_timedelta(s):
	matches = list(TIMEDELTA_BIT_REGEX.finditer(s))
	if len(matches) == 0:
		raise ValueError('no time information in string')

	data = { k: None for k in ('weeks', 'days', 'hours', 'minutes', 'seconds', 'microseconds', 'milliseconds') }

	for m in matches:
		val = int(m.group(1))
		typ = m.group(2)

		key = None
		for k, typs in TIMEDELTA_ALIASES.items():
			if typ in typs:
				key = k
				break

		if key is None:
			raise ValueError(f'unknown timedelta part {m.group(0)}')
		else:
			if data[key] is not None:
				raise ValueError(f'repeated {key}')
			else:
				data[key] = val

	return timedelta(**{ k: (v if v is not None else 0) for k, v in data.items() })

def parse_frame_every(s):
	try:
		return int(s)
	except ValueError:
		try:
			return parse_timedelta(s)
		except Exception:
			raise argparse.ArgumentTypeError(f'frame every is not an integer or a time delta')

def parse_pixel_offset(s):
	try:
		return int(s)
	except ValueError:
		try:
			return parse_logs_time(s.replace(';', ' '))
		except Exception as a:
			raise argparse.ArgumentTypeError(f'pixel offset is not an integer or a timestamp in the format "{LOGS_TIME_HUMAN_READABLE}"')

if __name__ == '__main__':
	import sys

	# parse arguments
	args_parser = argparse.ArgumentParser()
	args_parser.add_argument('logs_path', help='path to pixels.log', type=Path)
	args_parser.add_argument('--default-board-path', help='path to default_board.dat', type=Path, default=None)
	args_parser.add_argument('--config-path', help='path to pxls.conf', type=Path, default=None, metavar='path/to/pxls.conf')
	args_parser.add_argument('--output-path', help='where to save the output file(s)', type=Path, default=None, metavar='/path/to/output.gif')
	args_parser.add_argument('--format', help='format in which the timelapse is saved. if set to png, then every frame is saved inside the output path', choices=['png', 'gif'], default='gif')

	args_parser.add_argument('-v', '--verbose', help='print pixels added to the timelapse', dest='verbose', action='store_true')
	args_parser.add_argument('--force-overwrite', help='don\'t ask to overwrite output path', dest='force_overwrite', action='store_true')

	# > gif format arguments
	loop_args_parser = args_parser.add_mutually_exclusive_group(required=False)
	loop_args_parser.add_argument('--loop', help='when using gif format, make the gif loop', dest='loop', action='store_true')
	loop_args_parser.add_argument('--no-loop', help='when using gif format, make the gif not loop', dest='loop', action='store_false')
	args_parser.set_defaults(loop=False)

	args_parser.add_argument('-d', '--frame-duration', help='when using gif format, duration of each frame', type=int, default=20, metavar='milliseconds')

	# > png format arguments
	args_parser.add_argument('--diff', '--difference-mode', help='when using png format, make frames transparent by default, only including the pixels that changed from the previous frame', dest='difference_mode', action='store_true')
	args_parser.set_defaults(difference_mode=False)

	# > arguments for any format
	args_parser.add_argument('-e', '--every', help='how many pixels', type=parse_frame_every, default=1, metavar=f'{{number of pixels,time delta}}')
	args_parser.add_argument('--from', help=f'starting pixel offset; defaults to the beginning of the logs; can be a line number or a timestamp', type=parse_pixel_offset, default=None, metavar=f'{{line number,"{LOGS_TIME_HUMAN_READABLE}"}}', dest='start')
	args_parser.add_argument('--to', help=f'ending pixel offset; defaults to the end of the logs; can be a number; can be a line number or a timestamp', type=parse_pixel_offset, default=None, metavar=f'{{line number,"{LOGS_TIME_HUMAN_READABLE}"}}', dest='end')
	args_parser.add_argument('-r', '--region', help='a region to save; defaults to the entire canvas', type=int, nargs=4, metavar=('x1', 'y1', 'x2', 'y2'))
	args_parser.add_argument('--scale', help='by how much multiply the output; so that each pixel is scale:1 with the canvas', type=int, default=1)

	args_parser.add_argument('--user-filter', help='list of users to filter in', type=str, nargs='+', default=None)
	args_parser.add_argument('--user-color-codes', help='alongside user-filter, list of colors in HEX that are mapped to each user in the user-filter and used in place of the canvas colors; useful for finding who placed which pixel', type=parse_hex_arg, nargs='+', default=None)

	args = args_parser.parse_args()

	print_err = lambda *v: print(*v, file=sys.stderr)
	is_no = lambda v: v in ('n', 'no')

	# check logs path
	if not args.logs_path.is_file():
		print_err(f'logs file at {args.logs_path.resolve()} doesn\'t exist')
		sys.exit(1)

	# check default_board.dat
	if args.default_board_path is not None and not args.default_board_path.is_file():
		print_err(f'board file at {args.default_board_path.resolve()} doesn\'t exist')
		sys.exit(1)

	# check user color codes length
	if args.user_filter is not None and args.user_color_codes is not None:
		if len(args.user_filter) != len(args.user_color_codes):
			print_err('the amount of user color codes doesn\'t match the amount of users filtered')
			sys.exit(1)

	canvas_width = None
	canvas_height = None
	hex_palette = None
	default_color_idx = 0
	def read_config(path):
		from pyhocon import ConfigFactory as HoconConfigFactory

		config = HoconConfigFactory.parse_file(path.absolute())

		global canvas_width, canvas_height, hex_palette, default_color_idx
		canvas_width = config.get('board.width')
		canvas_height = config.get('board.height')
		hex_palette = config.get('board.palette')
		default_color_idx = config.get('board.defaultColor')

	# read config from specified path
	if args.config_path is not None:
		# config path specified as program argument
		if not args.config_path.is_file():
			print_err(f'{args.config_path} not found')
			sys.exit(1)
		read_config(args.config_path)
	else:
		config_path = find_config_path()
		if config_path and not is_no(input(f'Use config file found at {config_path.resolve()}? [Y/n]: ')):
			# read from found config path
			read_config(config_path)
		else:
			# ask for config parameters we care about

			while canvas_width is None:
				try:
					canvas_width = int(input('Board width: '))
				except ValueError:
					print('Width is not an integer')

			if args.default_board_path is None:
				while canvas_width is None:
					try:
						canvas_width = int(input('Board height: '))
					except ValueError:
						print('Height is not an integer')

			while	hex_palette is None:
				try:
					hex_palette = loads(input('Palette array: '))

					if type(hex_palette) != list or any(type(v) != str or not HEX_COLOR_REGEX.match(v) for v in hex_palette):
						hex_palette = None
						raise Exception('Invalid array format')
					if len(hex_palette) == 0:
						hex_palette = None
						raise Exception('Palette must not be empty')
				except KeyboardInterrupt as kerr:
					raise kerr
				except Exception as err:
					print(f'{err.args[0]}. Array must be in the format: \'["#000000", "#FF0000", ...]\'')

	# get output path
	output_path = None
	if args.output_path is None:
		default_output_path = args.logs_path.with_suffix('.gif' if args.format == 'gif' else '')
		output_path_input = input(f'Output file [{default_output_path}]: ')
		output_path = default_output_path if len(output_path_input) == 0 else Path(output_path_input)
	else:
		output_path = Path(args.output_path)

	if output_path.exists() and not args.force_overwrite:
		if is_no(input(f'Output file already exists, overwrite it? [Y/n]: ')):
			sys.exit(0)

	color_code_mode = args.user_filter is not None and args.user_color_codes is not None

	# generate palette
	im_palette = []
	im_palette.extend([0] * 3)
	if color_code_mode:
		for rgb in args.user_color_codes:
			im_palette.extend(rgb)
	else:
		for h in hex_palette:
			im_palette.extend(hex_to_rgb(h))


	# get board height and default_board size if provided
	default_board_size = None
	if args.default_board_path is not None:
		default_board_size = args.default_board_path.stat().st_size
		canvas_height = default_board_size / canvas_width
		if canvas_height != floor(canvas_height):
			print_err('File size isn\'t divisible by canvas width')
			sys.exit(1)
		canvas_height = floor(canvas_height)

	(region_left, region_top, region_right, region_bottom) = args.region or (0, 0, canvas_width, canvas_height)
	im_width = region_right - region_left
	im_height = region_bottom - region_top

	get_palette_color_idx = lambda idx: (idx + 1) if (idx % 256) != 0xFF else 0

	# Start making the timelapse
	print('Making timelapse...')

	imgs = []
	frame_durations = []
	pixels = None

	def new_frame(im):
		global imgs, frame_durations, pixels
		im.putpalette(im_palette, rawmode='RGB')
		imgs.append(im)
		frame_durations.append(args.frame_duration)
		pixels = im.load()

	new_frame(Image.new('P', (im_width, im_height), color=0))

	if not color_code_mode:
		if args.default_board_path is not None:
			with args.default_board_path.open('rb') as defaultboard_file:
				bs = defaultboard_file.read()

				for x in range(im_width):
					for y in range(im_height):
						i = (x + region_left) + (y + region_top) * canvas_width
						color_idx = bs[i]
						pixels[x, y] = get_palette_color_idx(color_idx)
		else:
			default_color_palette_idx = get_palette_color_idx(default_color_idx)
			for x in range(im_width):
				for y in range(im_height):
					pixels[x, y] = default_color_palette_idx

	new_frame(imgs[-1].copy())

	has_started = args.start is None
	accumulator = None
	do_new_frame = False
	pixel_delta = []
	with args.logs_path.open('r') as logs_file:
		for i, line in enumerate(logs_file):
			line = line.rstrip('\n')
			split = line.split('\t')
			if len(split) == 7:
				del split[-2] # delete IPs
			elif len(split) != 6:
				print_err(f'line {i + 1} of {logs_file} is invalid')
				sys.exit(1)

			(timestamp, username, x, y, color_idx, action) = split
			timestamp = parse_logs_time(timestamp)
			x = int(x)
			if x < region_left or x >= region_right:
				continue
			y = int(y)
			if y < region_top or y >= region_bottom:
				continue
			color_idx = int(color_idx)

			if (isinstance(args.end, int) and i >= args.end) or (isinstance(args.end, datetime) and timestamp >= args.end):
				break

			if (isinstance(args.start, int) and args.start == i) or (isinstance(args.start, datetime) and timestamp >= args.start):
				has_started = True

			im_x = x - region_left
			im_y = y - region_top

			if color_code_mode:
				if not has_started:
					continue

				palette_color_idx = 0

				if username in args.user_filter:
					user_idx = args.user_filter.index(username)
					palette_color_idx = get_palette_color_idx(user_idx)
				elif pixels[im_x, im_y] == 0:
					# ignore pixels from users not on the filter if the pixel's location is already blank
					continue
			else:
				palette_color_idx = get_palette_color_idx(color_idx)

				if args.user_filter is not None and username not in args.user_filter:
					continue

			coords = (x, y)
			prev_palette_color_idx = imgs[-2].getpixel((im_x, im_y))
			if coords not in pixel_delta and prev_palette_color_idx != palette_color_idx:
				pixel_delta.append(coords)
			elif coords in pixel_delta and prev_palette_color_idx == palette_color_idx:
				pixel_delta.remove(coords)

			# pixels[im_x, im_y] = palette_color_idx
			imgs[-1].putpixel((im_x, im_y), palette_color_idx)

			if has_started and args.verbose:
				timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]
				print(f'{timestamp_str} {action:^15} {username:<32} @ ({x}, {y}) {hex_palette[color_idx]} ({color_idx})')

			if has_started:
				if isinstance(args.every, int):
					# accumulator stores the amount of pixels we've drawn into the current frame
					if accumulator is None:
						accumulator = 0
					accumulator += 1
					if accumulator >= args.every:
						accumulator = 0
						do_new_frame = True
				elif isinstance(args.every, timedelta):
					# accumulator stores the timestamp of the last pixel we've drawn into the current frame
					if accumulator is None:
						accumulator = timestamp - args.every
					if (timestamp - accumulator) >= args.every:
						accumulator = None
						do_new_frame = True

				if do_new_frame:
					# NOTE(netux): we always create a copy of the previous image when making a gif because
					# not doing so produces a glitchy image with incorrect colors and missing frames.
					# Luckly, Pillow takes care of optimizing the final image so that all pixels not changed
					# from one frame to the other are made transparent.
					#
					# BUG(netux): if more than one pixel has changed between frames, the output gif may
					# still be glitch.
					if args.format == 'gif' and len(pixel_delta) == 0:
						frame_durations[-2] += args.frame_duration
					else:
						im = None
						if args.format == 'png' and args.difference_mode:
							im = Image.new('P', (im_width, im_height), color=0)
						else:
							im = imgs[-1].copy()
						new_frame(im)
					pixel_delta.clear()
					do_new_frame = False

	if args.scale > 1:
		for i in range(len(imgs)):
			imgs[i] = imgs[i].resize((im_width * args.scale, im_height * args.scale), resample=Image.NEAREST)

	print('Done.')

	if args.format == 'gif':
		imgs[0].save(
			output_path.with_suffix('.gif'),
			format='GIF',
			save_all=True,
			append_images=imgs[1:],
			transparency=0,
			disposal=1,
			duration=frame_durations,
			loop=0 if args.loop else 1,
			optimize=False
		)
	elif args.format == 'png':
		output_path = output_path.with_suffix('')
		if output_path.exists():
			for p in output_path.glob('*'):
				p.unlink()
		else:
			output_path.mkdir()

		frame_number_padding = len(str(len(imgs)))
		for i, im in enumerate(imgs):
			im.save(
				output_path / f'frame-{str(i).zfill(frame_number_padding)}.png',
				format='PNG',
				transparency=0
			)

	print(f'Saved to {output_path}')
