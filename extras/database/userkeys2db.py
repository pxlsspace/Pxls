"""
userkeys2db.py - insert user keys used in a hash-sanitized log into the database for retrieval by users.
"""
from datetime import datetime
from getpass import getpass
from pathlib import Path

import psycopg2

if __name__ == '__main__':
	import sys
	import argparse

	args_parser = argparse.ArgumentParser()
	args_parser.add_argument('db', help='name of the database', metavar='DBNAME', default='pxls')
	args_parser.add_argument('-u', '--user', '--username', help='user to connect to the database', metavar='NAME', default='pxls')
	args_parser.add_argument('-w', '--no-pass', '--no-password', help='do not prompt for password', action='store_true', default=False)
	args_parser.add_argument('-H', '--host', help='host of the database', metavar='HOSTNAME', default='127.0.0.1')
	args_parser.add_argument('-p', '--port', help='port of the database', type=int, metavar='PORT', default=5432)
	args_parser.add_argument('-f', '--file', help='input file', type=Path, metavar='FILENAME', default='user_keys.csv')
	args_parser.add_argument('-c', '--canvas', required=True, help='code of canvas to store in database associated with the key')
	args_parser.add_argument('-d', '--dry-run', help='do not commit to the database', action='store_true', default=False)

	args = args_parser.parse_args()

	print_err = lambda v: sys.stderr.write(str(v) + '\n')

	print('Connecting to database…')
	conn = psycopg2.connect(
		user=args.user,
		password=getpass(f'{args.user}\'s database password: ') if not args.no_pass else None,
		host=args.host,
		port=args.port,
		database=args.db
	)

	print(f'Inserting user keys from {args.file} into the database…')
	with args.file.open('r') as file:
		with conn.cursor() as cur:
			try:
				for line in file.readlines():
					(user, key) = line.split(',')
					cur.execute('''
						INSERT INTO user_keys (uid, key, canvas_code) VALUES(%s, %s, %s)
					''', (int(user.strip()), key.strip(), args.canvas))
				if not args.dry_run:
					conn.commit()
			except KeyboardInterrupt:
				print('Interrupted, rolling-back')

	conn.close()
