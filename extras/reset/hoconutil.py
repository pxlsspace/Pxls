import re
import json


def _get_ending_bracket_pos(content, start):
	level = 0
	for i, c in enumerate(content[start:]):
		if c == '{':
			level += 1
		elif c == '}':
			if level == 0:
				return start + i
			level -= 1

	return None

def _replace_hocon_value(content, key, value):
	regex_safe_key = key.replace('.', r'\.')
	match = re.search(f"^[\t ]*{regex_safe_key}: (.+)$", content, re.MULTILINE)
	if match:
		content = content[0:match.start(1)] + json.dumps(value) + content[match.end(1):]
	else:
		for i in range(key.count('.') + 1, 1, -1):
			key_path = key.rsplit('.', i)
			match = re.search(f"^[\t ]*{key_path[0]} {{$", content, re.MULTILINE)
			if match:
				start = match.end(0)
				end = _get_ending_bracket_pos(content, start)
				content = content[0:start] + _replace_hocon_value(content[start:end], '.'.join(key_path[1:]), value) + content[end:]
				return content
		raise Exception('Key not found')
	
	return content

def replace_hocon_value(file_path, key, value):
	content = file_path.read_text()
	content = _replace_hocon_value(content, key, value)
	file_path.write_text(content)


if __name__ == '__main__':
	from sys import argv
	from pathlib import Path

	replace_hocon_value(Path('test.conf'), argv[1], json.loads(argv[2]))
	
