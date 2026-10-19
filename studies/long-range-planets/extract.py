"""Extract only numeric coefficient tables from a downloaded JPL source page.

python extract.py approx_pos.html extracted.json
Compare output with coefficients.json; the source receipt pins the original HTML.
"""
import html
import json
import re
import sys
from pathlib import Path

blocks = [html.unescape(b) for b in re.findall(r'<pre>(.*?)</pre>', Path(sys.argv[1]).read_text(), re.S)]
assert len(blocks) == 3
result = {}
for label, block in zip(('table1', 'table2'), blocks[:2], strict=True):
    lines = block.splitlines()
    table = {}
    for i, line in enumerate(lines):
        match = re.match(r'\s*(Mercury|Venus|EM Bary|Mars|Jupiter|Saturn)\s+([-\d].*)', line)
        if match:
            base = list(map(float, match[2].split()))
            rates = list(map(float, lines[i+1].split()))
            assert len(base) == len(rates) == 6
            table['Earth' if match[1] == 'EM Bary' else match[1]] = {'base': base, 'rates': rates}
    assert len(table) == 6
    result[label] = table
for line in blocks[2].splitlines():
    match = re.match(r'\s*(Jupiter|Saturn)\s+([-\d].*)', line)
    if match:
        correction = list(map(float, match[2].split()))
        assert len(correction) == 4
        result['table2'][match[1]]['correction'] = correction
Path(sys.argv[2]).write_text(json.dumps(result, indent=2)+'\n')
