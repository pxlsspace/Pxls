from PIL import Image
import os
import json
import re
import sys
convertpath = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)),".."))
configpath = convertpath+"\\pxls.conf"
print(configpath)
configfile = open(configpath,"r+")
config = str(configfile.read())
configfile.close()
hexToRGB = lambda hex : tuple(int(hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
lines = [line.strip() for line in config.splitlines()]

paletteMatch = None

for line in lines:
    paletteMatch = paletteMatch or re.search('^palette: (\[.+\])', line)

paletteArr = json.loads(paletteMatch.group(1))

palette = [hexToRGB(hex) for hex in paletteArr]
print(palette)
#Getting paths
image = sys.argv[1]
placemap = sys.argv[2]
output = 'default_board.dat'
pmoutput = 'placemap.dat'
img = Image.open(image)
pix = img.load()
pmimg = Image.open(placemap)
pmpix = pmimg.load()
width = img.size[0]
height = img.size[1]
print('Width:', width)
print('Height:', height)


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

with open(output, 'wb+') as f:
	f.truncate()
	for y in range(height):
		for x in range(width):
			p = pix[x, y]
			b = 0xFF
			if p[3] == 255:
				c = (p[0], p[1], p[2])
				b = color_to_palette(c)
				i += 1
			f.write(bytes([b]))

with open(pmoutput, 'wb+') as f:
	f.truncate()
	for y in range(height):
		for x in range(width):
			p = pmpix[x, y] # (r, g, b, a)
			b = 0xFF
			if p[3] == 255:
				b = 0x00
			f.write(bytes([b]))

print(i)
