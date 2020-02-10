"""
sanitize.py - Remove IPs from pixel logs
Based off NodeJS version.

Author: Martín "Netux" Rodriguez
"""

import re
from pathlib import Path

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
			for line in log_file:
				# DATE\tUSERNAME\tX\tY\tCOLOR_INDEX\tIP\tACTION_TYPE
				split_line = line.split('\t')
				del split_line[5]
				output_file.write('\t'.join(split_line))

