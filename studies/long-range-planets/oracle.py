"""Read pinned Horizons responses and rotate ICRF vectors with compiled ERFA.

Python 3.12; numpy==2.4.4 pyerfa==2.0.1.5. No Horologium imports or network.
python oracle.py oracle.json
"""
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import erfa
import numpy as np

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'sources.json').read_text())
grid = json.loads((root / 'grid.json').read_text())['jds']
coeff = json.loads((root / 'coefficients.json').read_text())['table2']
records = {name: [] for name in ('mercury', 'venus', 'mars', 'jupiter', 'saturn')}
for query in manifest['queries']:
    raw = gzip.decompress((root / query['path']).read_bytes())
    assert len(raw) == query['bytes']
    assert hashlib.sha256(raw).hexdigest() == query['sha256']
    obj = json.loads(raw)
    assert not obj.get('error')
    text = obj['result']
    assert 'Reference frame : ICRF' in text
    assert 'Earth (399)' in text and '{source: DE441}' in text
    assert 'Output type     : GEOMETRIC' in text
    assert query['parameters']['REF_PLANE'] == 'FRAME'
    assert query['parameters']['TIME_TYPE'] == 'TDB'
    assert query['parameters']['VEC_CORR'] == 'NONE'
    for line in text.split('$$SOE\n')[1].split('$$EOE')[0].strip().splitlines():
        columns = line.split(',')
        records[query['name']].append([float(columns[0]), *map(float, columns[2:5])])


def elements_vector(name, jd, corrections=True):
    """Independent source-table calculation, in NumPy, for transcription checks."""
    row = coeff[name]
    t = (jd - 2451545) / 36525
    a, e, inc, lon, peri, node = np.array(row['base']) + t * np.array(row['rates'])
    m = lon - peri
    if corrections and 'correction' in row:
        b, c, s, f = row['correction']
        m += b*t*t + c*math.cos(math.radians(f*t)) + s*math.sin(math.radians(f*t))
    m = math.radians((m + 180) % 360 - 180)
    E = m
    for _ in range(20):
        E -= (E - e*math.sin(E) - m) / (1 - e*math.cos(E))
    w, n, i = np.radians([peri-node, node, inc])
    # Active rotations, first perihelion, then inclination, then ascending node.
    def rz(angle):
        c, s = math.cos(angle), math.sin(angle)
        return np.array([[c,-s,0],[s,c,0],[0,0,1]])
    ci, si = math.cos(i), math.sin(i)
    rx = np.array([[1,0,0],[0,ci,-si],[0,si,ci]])
    return rz(n) @ rx @ rz(w) @ np.array([a*(math.cos(E)-e), a*math.sqrt(1-e*e)*math.sin(E), 0])


def longitude(v):
    return math.degrees(math.atan2(v[1], v[0])) % 360


positions = []
# Same J2000 ecliptic convention as product, converted to ICRF then via ERFA.
# Frame bias is below this low-order orbital fit's precision; retain its effect.
eps = math.radians(84381.406 / 3600)
to_equator = np.array([[1,0,0],[0,math.cos(eps),-math.sin(eps)],[0,math.sin(eps),math.cos(eps)]])
for name, rows in records.items():
    assert [r[0] for r in rows] == grid
    for jd, x, y, z in rows:
        matrix = erfa.ecm06(2451545, jd - 2451545)
        earth = elements_vector('Earth', jd)
        fit = elements_vector(name.title(), jd) - earth
        no_terms = elements_vector(name.title(), jd, False) - earth
        positions.append({'name': name.title(), 'jd': jd,
                          'longitudeDeg': longitude(matrix @ np.array([x,y,z])),
                          'table2LongitudeDeg': longitude(matrix @ to_equator @ fit),
                          'table2VectorJ2000': fit.tolist(),
                          'withoutTable2bDeg': longitude(matrix @ to_equator @ no_terms)})
result = {'source': 'JPL Horizons DE441: geometric planet-system barycenters relative to Earth center, ICRF -> ERFA IAU 2006 mean ecliptic of date',
          'timescale': 'Same nominal JDTDB; no conversion from the app civil clock or historical Earth rotation',
          'versions': {'numpy': np.__version__, 'pyerfa': erfa.__version__},
          'positions': positions}
Path(sys.argv[1]).write_text(json.dumps(result, separators=(',', ':'))+'\n')
print(json.dumps({'dates':len(grid),'positions':len(positions)}))
