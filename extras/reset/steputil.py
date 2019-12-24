import sys

def print_step(idx, opts):
	name_or_key = opts.get('name', opts.get('key', '???'))
	if 'name' in opts and 'key' in opts:
		name_or_key += f" [{opts['key']}]"
	print(f"{idx}. {name_or_key}")
print_err = lambda s: sys.stderr.write(s)
is_yes = lambda s: s.lower() in ('y', 'yes')
is_no = lambda s: s.lower() in ('n', 'no')
goodbye = lambda: sys.exit(0)
badbye = lambda: sys.exit(1)
