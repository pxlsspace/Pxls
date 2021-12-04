"""
sanitize.py - Remove IPs from pixel logs
Based off NodeJS version.

Author: Martín "Netux" Rodriguez
"""

import re
import secrets
from hashlib import sha256
from pathlib import Path

# IPv6 regex from https://stackoverflow.com/a/17871737/7492433
IP_REGEX = re.compile(r'(?:\d{1,3})(?:\.(?:\d{1,3})){3}|(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))', re.IGNORECASE)

if __name__ == '__main__':
	import sys
	import argparse

	args_parser = argparse.ArgumentParser()
	args_parser.add_argument('logs_path', help='path to pixels.log', type=Path, default='pixels.log')
	args_parser.add_argument('--output-path', help='where to save the output', type=Path, default=None)
	args_parser.add_argument('--snip', '--snip-mode', help='whether to change the usernames to -snip-', dest='snip_mode', action='store_true')
	args_parser.add_argument('--hash', '--hash-mode', help='whether to replace the username with a verifyable hash', dest='hash_mode', action='store_true')
	args_parser.add_argument('--keys-out', '--keys-output-path', help='where to save user keys used in hashing', dest='keys_output_path', type=Path, default='user_keys.csv')
	args_parser.add_argument('--keys-in', '--keys-input-path', help='path to user keys to be used in hashing', dest='keys_input_path', type=Path, default=None)
	args_parser.add_argument('--key-strength', help='length of generated keys in bytes', type=int, default=256)

	args = args_parser.parse_args()

	print_err = lambda v: sys.stderr.write(str(v) + '\n')

	output_path = args.output_path if args.output_path is not None else args.logs_path.with_suffix('.sanit' + args.logs_path.suffix)

	if not args.logs_path.exists():
		print_err(f'{args.logs_path.name} doesn\'t exist')
		sys.exit(1)

	if args.snip_mode and args.hash_mode:
		print_err('snip_mode and hash_mode cannot be used together')
		sys.exit(1)

	keys = {}
	
	if args.hash_mode and args.keys_input_path:
		with args.keys_input_path.open('r', encoding='utf-8') as keys_file:
			for line in keys_file:
				if line.strip():
					(user, key) = line.split(',')
					keys[user] = key.strip()

	with args.logs_path.open('r', encoding='utf-8') as log_file:
		with output_path.open('w', encoding='utf-8') as output_file:
			for i, line in enumerate(log_file):
				# DATE\tUSERNAME\tX\tY\tCOLOR_INDEX\tIP\tACTION_TYPE
				split_line = line.split('\t')
				out_line = None

				if len(split_line) != 7:
					print(f'Line {i + 1} doesn\'t have exactly 7 fields. Manual review needed.')
					out_line = line
				else:
					(date, uid, username, x, y, color_index, action_type) = split_line

					if args.snip_mode:
						username = '-snip-'
					elif args.hash_mode:
						if uid in keys:
							key = keys[uid]
						else:
							key = secrets.token_hex(args.key_strength)
							keys[uid] = key

							if args.keys_input_path:
								print(f'Missing key for user: {username} ({uid}), generated key: {key}')

						username = sha256(f'{date},{x},{y},{color_index},{key}'.encode('utf-8')).hexdigest()

					out_line = f'{date}\t{username}\t{x}\t{y}\t{color_index}\t{action_type}'
					if IP_REGEX.search(out_line):
						print(f'Failed to remove IP on line {i + 1}. Manual review needed.')
						out_line = line

				output_file.write(out_line)
	
	if args.hash_mode and not args.keys_input_path:
		# if the keys output path is relative, this will put it in the output path
		# otherwise, it will keep the same absolute path
		keys_output_path = output_path.parent.joinpath(args.keys_output_path)
		with keys_output_path.open('w', encoding='utf-8') as keys_file:
			for user, key in keys.items():
				keys_file.write(f'{user},{key}\n')

	print('Done.')
