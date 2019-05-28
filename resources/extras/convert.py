from PIL import Image
import os
import json
from colors import rgb, hex
print(tuple(hex('FFFFFF').rgb))
convertpath = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)),".."))
configpath = convertpath+"\\pxls.conf"
print(configpath)

configfile = open(configpath,"r+")
config = str(configfile.read())
palpos = "Null"
#Finding pallete variable position
for i in range(len(config)):
        if config[i] == "p":
                if config[i+1] == "a":
                        if config[i+2] == "l":
                                if config[i+3] == "e":
                                        if config[i+4] == "t":
                                                if config[i+5] == "t":
                                                        if config[i+6] == "e":
                                                                if config[i-1] == " ":
                                                                        palpos = i
                                                                        break
                                                                if config[i-1] == "\n":
                                                                        palpos = i
print("Palette variable character position:", str(palpos))
paljson = "{\""
#Preparing for json readability
for j in range(len(config)-palpos):
        if config[j+palpos] == " ":
                paljson = paljson+"\""+config[j+palpos]
                posa = j
                break
        elif config[j+palpos] == ":":
                paljson = paljson+"\""+config[j+palpos]
                posa = j
                break
        else:
                paljson = paljson+config[j+palpos]
for k in range(len(config)-palpos-posa-1):
        if config[k+palpos+posa+1] == "\n":
                break
        paljson = paljson+config[k+palpos+posa+1]
paljson = paljson+"}"
paljson = json.loads(paljson)
paljson = paljson['palette']
palette = []
#Converting RRGGBB to (R,G,B)
for l in range(len(paljson)):
        current = paljson[l]
        palette.append(tuple(hex(current[1]+current[2]+current[3]+current[4]+current[5]+current[6]).rgb))
print("Palette: ",palette)
#Getting paths
image = input("Canvas path: ")
placemap = input("Placemap path: ")
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
