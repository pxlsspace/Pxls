"""
sanitize.py - Remove IPs from pixel logs
Based off NodeJS version.

Author: Martín "Netux" Rodriguez
"""

import re
from pathlib import Path

# IPv6 regex from https://stackoverflow.com/a/17871737/7492433
IP_REGEX = re.compile(r'(?:\d{1,3})(?:\.(?:\d{1,3})){3}|(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))', re.IGNORECASE)

if __name__ == '__main__':
	import sys
	import argparse

	args_parser = argparse.ArgumentParser()
	args_parser.add_argument('logs_path', help='path to pixels.log', type=Path, default='pixels.log')
	args_parser.add_argument('--output-path', help='where to save the output', type=Path, default=None)
	args_parser.add_argument('--snip', '--snip-mode', help='whenever to also change the usernames to -snip-', dest='snip_mode', action='store_true')

	args = args_parser.parse_args()

	print_err = lambda v: sys.stderr.write(str(v) + '\n')

	output_path = args.output_path if args.output_path is not None else args.logs_path.with_suffix('.sanit' + args.logs_path.suffix)

	if not args.logs_path.exists():
		print_err(f'{args.logs_path.name} doesn\'t exist')
		sys.exit(1)

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
					del split_line[5]

					if args.snip_mode:
						split_line[1] = '-snip-'

					out_line = '\t'.join(split_line)
					if IP_REGEX.search(out_line):
						print(f'Failed to remove IP on line {i + 1}. Manual review needed.')
						out_line = line

				output_file.write(out_line)

			print('Done.')
