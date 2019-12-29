#!/usr/bin/python3
from PIL import Image
import json
import os
import re
import sys

# Getting palette

# /absolute/path/to/Pxls
convertpath = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), '../..'))
# /absolute/path/to/Pxls/pxls.conf
configpath = convertpath + '\\pxls.conf'

try:
	lines = None
	with open(configpath, 'r+') as configfile:
		config = str(configfile.read())
		lines = [line.strip() for line in config.splitlines()]

	for line in lines:
		paletteMatch = re.search('^palette: (\[.+\])', line)
		if paletteMatch is not None:
			paletteRaw = paletteMatch.group(1)
			break
except FileNotFoundError:
	print('Cannot find pxls.conf in previous directory')
	paletteRaw = input('Input palette array manually in the format \'["#000000", "#FF0000", ...]\': ')

paletteArr = json.loads(paletteRaw)

hexToRGB = lambda hex : tuple(int(hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
palette = [hexToRGB(hex) for hex in paletteArr]

# Getting paths

imagePath = sys.argv[1]
placemapPath = sys.argv[2] if len(sys.argv) > 2 else None

outputPath = 'default_board.dat'
pmoutputPath = 'placemap.dat'

img = Image.open(imagePath)
if img.mode != 'RGBA':
	img = img.convert('RGBA')
pix = img.load()

if placemapPath:
	pmimg = Image.open(placemapPath)
	if pmimg.mode != 'RGBA':
		pmimg = pmimg.convert('RGBA')
	pmpix = pmimg.load()

width = img.size[0]
height = img.size[1]

if placemapPath:
	if pmimg.size[0] != width or pmimg.size[1] != height:
		print(f"{placemapPath} dimensions ({pmimg.size[0]}x{pmimg.size[1]}) don't match {imagePath} dimensions ({width}x{height})")
		sys.exit(1)

print(f'Board is {width}x{height}')

# Convertion

def color_to_palette(c):
	for i in range(len(palette)):
		if c == palette[i]:
			return i
	diff = []
	for i in range(len(palette)):
		diff.append(sum([abs(palette[i][j] - c[j]) for j in range(3)]))
	min = 0
	for i in range(len(diff)):
		if diff[i] < diff[min]:
			min = i
	return min

print('Converting...')

i = 0
with open(outputPath, 'wb+') as f:
	f.truncate()
	bs = []
	for y in range(height):
		for x in range(width):
			p = pix[x, y] # (r, g, b, a)
			b = 0xFF
			if p[3] == 255:
				c = (p[0], p[1], p[2])
				b = color_to_palette(c)
				i += 1
			bs.append(b)
	f.write(bytes(bs))
print(f"* Written {outputPath} ({i}/{width * height} non-transparent pixels)")

i = 0
with open(pmoutputPath, 'wb+') as f:
	f.truncate()
	bs = []
	for y in range(height):
		for x in range(width):
			b = 0xFF
			p = pmpix[x, y] if placemapPath else pix[x, y] # (r, g, b, a)
			if p[3] == 255:
				b = 0x00
				i += 1
			bs.append(b)
	f.write(bytes(bs))
print(f"* Written {pmoutputPath} ({i}/{width * height} placeable pixels)")
