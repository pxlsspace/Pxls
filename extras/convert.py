#!/usr/bin/python3
from PIL import Image
import json
import os
import re
import sys

# Getting palette

# /absolute/path/to/Pxls
convertpath = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), '..'))
# /absolute/path/to/Pxls/pxls.conf
configpath = convertpath + '\\pxls.conf'

configfile = open(configpath, 'r+')
config = str(configfile.read())
configfile.close()

hexToRGB = lambda hex : tuple(int(hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
lines = [line.strip() for line in config.splitlines()]

paletteMatch = None

for line in lines:
	paletteMatch = paletteMatch or re.search('^palette: (\[.+\])', line)

paletteArr = json.loads(paletteMatch.group(1))

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

print('Width:', width)
print('Height:', height)

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

i = 0

with open(outputPath, 'wb+') as f:
	f.truncate()
	for y in range(height):
		for x in range(width):
			p = pix[x, y] # (r, g, b, a)
			b = 0xFF
			if type(p) == int:
				p = (p, p, p, 255)
			if p[3] == 255:
				c = (p[0], p[1], p[2])
				b = color_to_palette(c)
				i += 1
			f.write(bytes([b]))

with open(pmoutputPath, 'wb+') as f:
	f.truncate()
	if placemapPath:
		for y in range(height):
			for x in range(width):
				b = 0xFF
				if placemapPath:
					p = pmpix[x, y] # (r, g, b, a)
					if type(p) == int:
						p = (p, p, p, 255)
					if p[3] == 255:
						b = 0x00
				f.write(bytes([b]))
	else:
		# assume the whole canvas is placeable
		f.write(bytes([0x00 for _ in range(width*height)]))

print(i)
