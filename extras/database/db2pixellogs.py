"""
db2pixellogs.py - Make a pixels.log from a Postgres database with a `pixels` and `users` table

Author: Martín "Netux" Rodriguez
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
	args_parser.add_argument('-f', '--file', help='output file', type=Path, metavar='FILENAME', default='pixels.log')

	args_parser.add_argument('--bulk-size', help='amount of pixels to fetch and write at once', type=int, default=100)
	args_parser.add_argument('--snip', '--snip-mode', help='whenever to also change the usernames to -snip-', dest='snip_mode', action='store_true')

	args = args_parser.parse_args()

	print_err = lambda v: sys.stderr.write(str(v) + '\n')

	print('Connecting to database...')
	conn = psycopg2.connect(
		user=args.user,
		password=getpass(f'{args.user}\'s database password: ') if not args.no_pass else None,
		host=args.host,
		port=args.port,
		database=args.db
	)

	cur = conn.cursor()

	cur.execute('SELECT count(*) FROM pixels;')
	pixel_count = cur.fetchone()[0]

	print(f'Transfering {pixel_count} pixels from the database to {args.file}, {args.bulk_size} pixels at a time')
	with args.file.open('w') as file:
		count = 0
		try:
			for offset in range(0, pixel_count, args.bulk_size):
				cur.execute('''
					SELECT
						p.time,
						CASE WHEN p.who IS NULL THEN NULL ELSE u.username END AS username,
						p.x,
						p.y,
						p.color,
						p.undo_action,
						p.mod_action,
						p.rollback_action,
						p.secondary_id IS NOT NULL AS has_secondary_id
					FROM pixels AS p
						INNER JOIN users AS u
						ON p.who = u.id
					ORDER BY p.time ASC
					LIMIT %s
					OFFSET %s;
				''', (args.bulk_size, offset))

				for dbpixel in cur.fetchall():
					action_str = 'user place'
					(time, user, x, y, color_idx, undo_action, mod_action, rollback_action, has_secondary_id) = dbpixel
					if mod_action:
						action_str = 'mod overwrite'
					elif rollback_action:
						action_str = 'rollback' if has_secondary_id else 'rollback undo'
					elif undo_action:
						action_str = 'user undo'
					elif user is None:
						user = '<server>'
						action_str = 'console nuke'

					time_str = time.strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]
					file.write('\t'.join(map(str, (time_str, user if not args.snip_mode else '-snip-', x, y, color_idx, action_str))) + '\n')
					count += 1
		except KeyboardInterrupt:
			file.flush()
			print(f'Interrupted, written {count} pixels (until {time} inclusive)')

		cur.close()
