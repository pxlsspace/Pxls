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

	USAGE = f'Usage: {sys.argv[0]} [path/to/pixels.log] [path/to/pixels.sanit.log]'
	print_err = lambda v: sys.stderr.write(str(v) + '\n')

	if '--help' in sys.argv:
		print(USAGE)
		sys.exit(0)

	log_path = Path(sys.argv[1] if len(sys.argv) > 1 else 'pixels.log')
	output_path = Path(sys.argv[2] if len(sys.argv) > 2 else log_path.with_suffix('.sanit' + log_path.suffix))

	if not log_path.exists():
		print_err(f'{log_path.name} doesn\'t exist')
		sys.exit(1)

	with log_path.open('r', encoding='utf-8') as log_file:
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

					out_line = '\t'.join(split_line)
					if IP_REGEX.search(out_line):
						print(f'Failed to remove IP on line {i + 1}. Manual review needed.')
						out_line = line

				output_file.write(out_line)

			print('Done.')

