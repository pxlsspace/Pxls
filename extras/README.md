# Pxls Extras

This folder contains miscellaneous scripts.

## convert.py

`convert.py` converts input images `canvas.png` and `placemap.png` to `default_board.dat` and `placemap.dat`. The input images must have a 32-bit depth (RGBA).

When using the script, colors will automatically be mapped to the palette, but using an input image with the same palette colors is more desirable.

### Requirements

- [Python 3.5\<](https://www.python.org/)
- [Pillow](https://pypi.org/project/Pillow/)

### Running

1. Place a `canvas.png` and `placemap.png` (described in the description) in the same directory as the script.
2. Execute the script with `python convert.py /path/to/canvas.png /path/to/placemap.png`

The output `default_board.dat` and `placemap.dat` will appear in the directory. They should be moved to the storage directory as configured in `pxls.conf`.

If the script is placed in any other directory than `Pxls/extras`, input the location of `pxls.conf` in the arguments.
