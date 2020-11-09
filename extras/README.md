# Pxls Extras

This folder contains miscellaneous scripts.

### Requirements

- [Python 3.7](https://www.python.org/)
- [Pipenv](https://pipenv.kennethreitz.org/en/latest/#install-pipenv-today)
- libpq (PostgreSQL bindings)
	- on Windows: bundled with the PostgreSQL installer
	- on Debian: `$ apt install libpq-dev`

Install the environment by running `pipenv install`.

## convert/img2board.py

`convert/img2board.py` converts input images `canvas.png` and `placemap.png` to `default_board.dat` and `placemap.dat`.

When using the script, colors will automatically be mapped to the palette, but using an input image with the same palette colors is more desirable.

### Running

1. Create a `canvas.png` and `placemap.png` (optional, transparent pixels for non-placeable).
2. Inside `convert/`, execute the script with `pipenv run python img2board.py /path/to/canvas.png /path/to/placemap.png`.

The output `default_board.dat` and `placemap.dat` will appear in the directory. They should be moved to the storage directory as configured in `pxls.conf`.

If the script is placed in any other directory than `Pxls/extras`, make sure to include a `pxls.conf` on the parent folder (e.g. if the script is in `a/folder/convert.py`, put `pxls.conf` on `a/pxls.conf`).


## convert/board2img.py

`convert/board2img.py` converts input data files `board.dat` to `board.png`.

### Running

1. Inside `convert/`, execute the script with `pipenv run python board2img.py /path/to/board.dat [mode]`, where `mode` is one of `board` (default), `placemap`, `heatmap`, `virginmap`.

The output `board.png` will appear in the directory.


## reset/reset.py

`reset/reset.py` aids to automate the process of resetting a canvas by reading the pxls.conf file and, among other things:
- Clears the database
- Changes the canvas
- Backups canvas-related files and the database

### Running

1. Copy `checklist.template.py` into `checklist.py`, add or remove steps as desired.
2. Make sure to have a `pxls.conf` somewhere in your PC. If the `pxls.conf` is placed as much as two directories above the `reset/` directory, the script will find it automatically.
3. Inside `reset/`, execute the script with `pipenv run python reset.py`.
	- add `-h` or `--help` to see a list of available arguments.
	- add `--list` to see a list of all steps.


## logs/sanitize.py

`logs/sanitize.py` removes the IPs from a log file and writes the sanitized logs into a new file.
By default, it reads from `pixels.log` and writes to `pixels.sanit.log`.

### Running

1. Inside `logs/`, execute the script with `pipenv run python sanitize.py [/path/to/pixels.log] [/output/path/pixels.sanit.log]`.
	- add `--snip` to also change all usernames to "-snip-"


## logs/timelapse.py

`logs/timelapse.py` allows for creating timelapses out of a `default_board.dat` (initial canvas state) and a `pixels.log` file (found in the _logs/_ directory).
It might also ask for the canvas width and palette used.

The script allows for customizing the output. Use the `--help` parameter to know more.

### Running

1. Make sure to have a `pxls.conf` somewhere in your PC. If the `pxls.conf` is placed as much as three directories above the `reset/` directory, the script will try find it automatically.
	- if it doesn't find it, you can specify it's path with the `--config-path /path/to/pxls.conf` argument
2. Inside `logs/`, execute the script with `pipenv run python timelapse.py /path/to/pixels.log`.
	- add `-h` or `--help` to see a list of available arguments
	- add `--default-board-path /path/to/default_board.dat` if you're using a custom `default_board.dat`

## database/db2pixellogs.py

`database/db2pixellogs.py` retrieves the pixels from the database and creates a (sanitized, with no IPs) `pixels.log` file.

It is recommended that nothing else interacts with the database while the script is running.

### Running

1. Make sure the database is running
2. Inside `database/`, execute the script with `pipenv run python db2pixellogs.py db_name -f /output/path/to/pixels.log`.
	- add `-h` or `--help` to see a list of available arguments
	- add `--bulk-size` to change how many pixels are retrieved from the database at a time
	- add `--snip` to write all usernames as "-snip-"
