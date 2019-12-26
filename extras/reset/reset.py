"""
reset.py - Run steps to reset the canvas
Author: Martín "Netux" Rodriguez
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from steputil import print_step, print_err, goodbye, badbye

steps = []
def step(**kargs):
	def _(func):
		steps.append((kargs, func))
		return func
	return _

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

	while config_path is None or not config_path.is_file():
		config_path = Path(input("pxls.conf not found, input path manually: "))

	return config_path.resolve()

def parse_database_url(url):
	if url.startswith('jdbc:'):
		url = url[5:]
	
	return urlparse(url)

def get_database(config):
	import psycopg2

	url = parse_database_url(config.get('database.url'))

	conn = psycopg2.connect(
		dbname=url.path[1:],
		host=url.hostname,
		port=url.port,
		user=config.get('database.user'),
		password=config.get('database.pass'),
	)
	return conn

def get_step_idx_from_input(steps, foo):
	idx = None
	try:
		idx = int(foo)
	except ValueError:
		for i, (opts, _) in enumerate(steps):
			key = opts.get('key', None)
			if key is not None and key.lower() == foo.lower():
				idx = i
				break
		
	return idx

if __name__ == "__main__":
	import argparse

	try:
		from checklist import create_steps
	except ModuleNotFoundError:
		print("Missing reset/checklist.py, copy reset/checklist.template.py into reset/checklist.py to continue.")
		badbye()

	args_parser = argparse.ArgumentParser()
	args_parser.add_argument('--list', help="Show a list of all steps", action='store_const', const=True)
	args_parser.add_argument('--step', help="Step from which start", default=0)
	args_parser.add_argument('--only', help="List of steps to run, only these steps will execute", nargs='+')
	args_parser.add_argument('--skip', help="List of steps to skip", nargs='+')
	args_parser.add_argument('--testport', help="Port temporarly set to test changes before deploying", default=54242)
	args = args_parser.parse_args()

	create_steps(step)

	if (args.list):
		for idx, (opts, _) in enumerate(steps):
			print_step(idx, opts)
		goodbye()

	step_idx = get_step_idx_from_input(steps, args.step)
	if step_idx is None:
		print_err("Starting step not found")
		badbye()

	config = None
	config_path = None
	prev_canvas_code = None
	db = None
	backup_storage_path = Path(__file__) / '..' / 'backup_storage'

	steps_to_run = range(step_idx, len(steps))
	if args.only:
		steps_to_run = [get_step_idx_from_input(steps, v) for v in args.only]
	
	for step_idx in steps_to_run:
		(opts, step_func) = steps[step_idx]
		print_step(step_idx, opts)

		if args.skip and step_idx in args.skip:
			print("Skipping...")
			continue

		kargs = {}

		uses_config = opts.get('uses_config', False)
		uses_db = opts.get('uses_db', False)
		if (uses_config or uses_db) and config is None:
			print("* Getting config.")

			config_path = get_config_path()
			print(f"Using pxls.conf at {config_path.absolute()}")

			from pyhocon import ConfigFactory

			config = ConfigFactory.parse_file(config_path.absolute())
			print("* Config read.")

			prev_canvas_code = config.get('canvascode')
			storage_path = config.get('server.storage')
			if storage_path == '.':
				storage_path = 'storage'
			backup_storage_path = config_path.parent / (storage_path + '-canvas-' + prev_canvas_code)
		
		if uses_config:
			kargs['config'] = config
			kargs['config_path'] = config_path
			kargs['prev_canvas_code'] = prev_canvas_code
		if uses_db:
			if db is None:
				print("* Connecting to database.")
				db = get_database(config)
				print("* Database connection established.")
			kargs['db'] = db

		kargs['backup_storage_path'] = backup_storage_path
		kargs['test_port'] = args.testport

		try:
			step_func(**kargs)
		except KeyboardInterrupt:
			print()
			print('Goodbye :)')
			goodbye()
		step_idx += 1
	
	if db:
		db.commit()
		print("* Disconnecting from database.")
		db.close()

	print()
	print("Done! Have a good day :)")
