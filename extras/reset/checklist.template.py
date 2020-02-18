"""
Working as of 24/12/19 (commit 6e17b5a8e1916a3751754327ac7c816d4c95ea3f)
"""


import re
import subprocess
from shutil import copy
from pathlib import Path
from os.path import basename
from operator import itemgetter
from json import loads as json_loads

from reset import parse_database_url
from hoconutil import replace_hocon_value
from steputil import is_yes, is_no, goodbye, badbye

def mkdir_ifnotexists(path):
	if not path.exists():
		path.mkdir()
		print(f'Created missing {path}')

def move_files(origin_path, target_path, filter):
	mkdir_ifnotexists(target_path)
	for filename in filter:
		for path in origin_path.glob(filename):
			target = target_path / (basename(path.resolve().absolute()))
			path.rename(target)
			print(f"Moved {path} to {target}")


# Checklist
def create_steps(step):
	@step(name="Confirmation", key="confirm")
	def step__confirmation(**kargs):
		if not is_yes(input("Are you sure you want to reset the canvas? [y/N]: ")):
			print("Come back when you are.")
			goodbye()
		if not is_yes(input("Are you really sure? Pixel data will be erased from the database and pixel counts will reset back to zero [y/N]: ")):
			print("Take your time, think it through, and come back when you are.")
			goodbye()

	@step(name="Shutdown server", key="shutdown")
	def step__shutdown_server(**kargs):
		if not is_yes(input("Is Pxls turned off? [y/N]: ")):
			print("Turn off Pxls to continue.")
			goodbye()

	@step(name="Set canvas code", key="canvascode", uses_config=True)
	def step__set_canvas_code(**kargs):
		config, config_path, current = itemgetter('config', 'config_path', 'prev_canvas_code')(kargs)

		suggested = None
		try:
			suggested = str(int(current) + 1)
		except ValueError:
			pass

		new = None
		while new is None:
			new = input(f"New canvas code?{' [' + suggested + ']' if suggested else ''}: {current} -> ")
			if len(new) == 0:
				new = suggested # None if suggestion couldn't be determined
			elif new == '-':
				new = current

		replace_hocon_value(config_path, 'canvascode', new)

	@step(name="Dump database", key="dumpdb", uses_config=True)
	def step__dumpdb(**kargs):
		config, config_path, storage_path = itemgetter('config', 'config_path', 'backup_storage_path')(kargs)

		db_url = parse_database_url(config.get('database.url'))
		db_user = config.get('database.user')
		db_password = config.get('database.pass')
		db_name = db_url.path[1:]

		mkdir_ifnotexists(storage_path)
		outpath = storage_path / (db_name + '.sql')
		with outpath.open('wb') as outfile:
			args = ['pg_dump']
			args.extend(('-h', db_url.hostname))
			args.extend(('-p', str(db_url.port)))
			if db_user:
				args.extend(('-U', db_user))
			args.extend(('-d', db_name))

			print('Running pg_dump...')
			if db_password:
				print(f'You may be prompted to type the database password for user {db_user}')

			with subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as proc:
				outfile.write(proc.stdout.read())

				status = proc.wait()
				if status != 0:
					print('Something went wrong, restart this script from this step')
					badbye()

	@step(name="Drop pixels table", key="droppixels", uses_db=True)
	def step__drop_pixels_table(**kargs):
		conn = itemgetter('db')(kargs)

		with conn.cursor() as cur:
			cur.execute("DROP TABLE IF EXISTS pixels;")
			print('Database ouput:', cur.statusmessage)

	@step(name="Reset user pixel count", key="resetcounts", uses_db=True)
	def step__reset_pixel_count(**kargs):
		conn = itemgetter('db')(kargs)

		with conn.cursor() as cur:
			cur.execute("UPDATE users SET pixel_count = 0;")
			print('Database ouput:', cur.statusmessage)

	@step(name="Backup storage folder", key="bkstorage", uses_config=True)
	def step__backup_storage_folder(**kargs):
		config, config_path, target_path = itemgetter('config', 'config_path', 'backup_storage_path')(kargs)

		origin_path = config_path.parent / config.get('server.storage')
		files_to_move = [
			'backups',
			'index_cache.html',
			'*.dat'
		]

		move_files(origin_path, target_path, files_to_move)

	@step(name="Backup logs folder", key="bklogs", uses_config=True)
	def step__backup_logs_folder(**kargs):
		config, config_path, prev_canvas_code = itemgetter('config', 'config_path', 'prev_canvas_code')(kargs)

		origin_path = config_path.parent / 'logs'
		target_path = config_path.parent / ('logs-canvas-' + prev_canvas_code)
		files_to_move = [ '*.log' ]

		move_files(origin_path, target_path, files_to_move)

	@step(name="Backup HTML files", key="bkhtml", uses_config=True)
	def step__backup_html_files(**kargs):
		config, config_path, storage_path = itemgetter('config', 'config_path', 'backup_storage_path')(kargs)

		config_html = config.get('html')
		files_to_copy = []
		for k in ('head', 'info', 'faq'):
			pathname = config_html[k]
			if pathname.startswith('resource:'):
				files_to_copy.append('resources' + pathname[9:])

		mkdir_ifnotexists(storage_path)
		for filepath in files_to_copy:
			origin = config_path.parent / filepath
			target = storage_path / basename(origin)
			copy(origin.absolute(), target.absolute())
			print(f"Copied {origin} to {target}")

	@step(name="Update palette (optional)", key="palette", uses_config=True)
	def step__update_palette(**kargs):
		config, config_path = itemgetter('config', 'config_path')(kargs)

		if not is_yes(input('Update palette colors? [y/N]: ')):
			return

		color_regex = re.compile(r'^#[a-f0-9]{6}$', re.IGNORECASE)

		palette = config.get('board.palette')
		new_palette = None
		while	new_palette is None:
			try:
				new_palette = json_loads(input('Paste Palette array: '))

				if type(new_palette) != list or any(type(v) != str or not color_regex.match(v) for v in new_palette):
					new_palette = None
					raise Exception('Invalid array format')

				palette = new_palette
			except:
				print('Invalid array format. Array must be in the format: \'["#000000", "#FF0000", ...]\'')

		replace_hocon_value(config_path, 'board.palette', new_palette)
		print('Palette updated')

		if not is_yes(input('Update default color index? [y/N]: ')):
			return

		new_default_color = None
		while new_default_color is None:
			try:
				new_default_color = int(input('New default color index: '))

				if new_default_color < 0 or new_default_color >= len(palette):
					new_default_color = None
					print('Default color index out of range')
			except ValueError:
				print('New default color index is not an integer')

		replace_hocon_value(config_path, 'board.defaultColor', new_default_color)
		print('Default color index updated')

	@step(name="Create and copy default_board.dat and placemap.dat (optional)", key="boarddata", uses_config=True)
	def step__make_data_files(**kargs):
		config, config_path = itemgetter('config', 'config_path')(kargs)

		if is_no(input('Use a default_board.dat (and placemap.dat)? [Y/n]: ')):
			default_color_hex = config.get('board.palette')[config.get('board.defaultColor')]
			print(f'Board will be a rectangle of color {default_color_hex}.')
			return

		default_board_path = Path(__file__).parent / '../convert/default_board.dat'
		default_placemap_path = Path(__file__).parent / '../convert/placemap.dat'

		board_path = default_board_path
		placemap_path = default_placemap_path
		use_placemap = True
		if board_path.is_file():
			if is_no(input('default_board.dat file found inside convert script folder, should it be used? [Y/n]: ')):
				board_path = None

		def ask_for_paths():
			board_path = None
			placemap_path = None
			use_placemap = True

			while not board_path or not board_path.is_file():
				default_exists = default_board_path.is_file()
				board_path_hint = f' [{str(default_board_path.relative_to("."))}]' if default_exists else ''
				board_path_input = input(f'Path to default_board.dat{board_path_hint}: ')
				if default_exists and len(board_path_input) == 0:
					board_path = default_board_path
				else:
					board_path = Path(board_path_input)
				if not board_path.is_file():
					print("File doesn't exist or isn't a file")

			while use_placemap and (not placemap_path or not placemap_path.is_file()):
				placemap_path_hint = f'{str(default_placemap_path.relative_to("."))}' if default_placemap_path.is_file() else 'ignore placemap'
				placemap_path_input = input(f'Path to placemap.dat [{placemap_path_hint}]: ')
				if len(placemap_path_input) == 0:
					use_placemap = False
				else:
					placemap_path = Path(placemap_path_input)
					if not placemap_path.is_file():
						print("File doesn't exist or isn't a file")

			return (board_path, placemap_path, use_placemap)

		if not board_path or not board_path.is_file():
			if is_no(input('Do you have a default_board.dat file to use? [Y/n]: ')):
				print('Run convert/img2board.py with a canvas.png and optional placemap.png and come back when you are done')
				input('Press enter to continue')
			board_path, placemap_path, use_placemap = ask_for_paths()

		storage_path = config_path.parent / config.get('server.storage')
		copy(str(board_path), str(storage_path / 'default_board.dat'))
		print(f'Copied {board_path.resolve()} to default_board.dat')

		if use_placemap and placemap_path.is_file():
			copy(str(placemap_path), str(storage_path / 'placemap.dat'))
			print(f'Copied {placemap_path.resolve()} to placemap.dat')

	@step(name="Set dimensions of new canvas", key="dimension", uses_config=True)
	def step__set_canvas_dimensions(**kargs):
		config, config_path = itemgetter('config', 'config_path')(kargs)

		for k in ('width', 'height'):
			old = config.get(f'board.{k}')
			new = None
			while new is None:
				new_input = input(f'New {k} [{old}]: ')
				if len(new_input) == 0:
					new = old
				else:
					try:
						new = int(new_input)
					except ValueError:
						print('Dimensions is not an integer')
			replace_hocon_value(config_path, k, new)

	@step(name="Test time (optional)", key="test", uses_config=True)
	def step__test(**kargs):
		config, config_path, test_port = itemgetter('config', 'config_path', 'test_port')(kargs)

		if is_no(input('Do you want to test if everything works? [Y/n]: ')):
			return

		current_port = config.get('server.port')
		replace_hocon_value(config_path, 'server.port', test_port)
		print(f'Port set to {test_port}, come back once you are done testing')
		print("If the colors are weird, run the image through the fiddle to convert the colors. Play around with the settings until it looks good.")
		print("If the above doesn't fix it, double check the board information in pxls.conf.")
		print("You can run this script again with the `--step N` parameter where N is the step number from which restart the script")
		print("Or you can try fixing the settings manually")
		print()
		input("Once you are ready, close the server and press enter to set the port back.")

		replace_hocon_value(config_path, 'server.port', current_port)
