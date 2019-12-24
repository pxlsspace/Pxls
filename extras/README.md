# Pxls Extras

This folder contains miscellaneous scripts.

### Requirements

- [Python 3.5 to 3.7](https://www.python.org/)
- [Pipenv](https://pipenv.kennethreitz.org/en/latest/#install-pipenv-today)

Install the environment by running `pipenv install`

## convert/img2board.py

`convert/img2board.py` converts input images `canvas.png` and `placemap.png` to `default_board.dat` and `placemap.dat`. The input images must have a 32-bit depth (RGBA).

When using the script, colors will automatically be mapped to the palette, but using an input image with the same palette colors is more desirable.

### Running

1. Create a `canvas.png` and `placemap.png` (optional, transparent pixels for non-placeable).
2. Inside `convert/`, execute the script with `pipenv run python img2board.py /path/to/canvas.png /path/to/placemap.png`

The output `default_board.dat` and `placemap.dat` will appear in the directory. They should be moved to the storage directory as configured in `pxls.conf`.

If the script is placed in any other directory than `Pxls/extras`, make sure to include a `pxls.conf` on the parent folder (e.g. if the script is in `a/folder/convert.py`, put `pxls.conf` on `a/pxls.conf`).


## reset/reset.py

`reset/reset.py` aids to automate the process of resetting a canvas by reading the pxls.conf file and, amongst other things:
- Clears the database
- Changes the canvas
- Backups canvas-related files and the database

### Running
1. Make sure to have a `pxls.conf` accessible. If the `pxls.conf` is placed as much as two directories above the `reset/` directory, the script will find it automatically.
2. Inside `reset/`, execute the script with `pipenv run python reset.py`
	- add `-h` or `--help` to see a list of available arguments.
	- add `--list` to see a list of all steps.
