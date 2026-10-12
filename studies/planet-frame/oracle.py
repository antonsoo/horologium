"""Independent frame and ephemeris fixtures; no Horologium imports.

python oracle.py /path/to/de440s.bsp output.json
Requires skyfield==1.54 numpy==2.4.4 pyerfa==2.0.1.5.
The local kernel is required: this script makes no network requests.
"""

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

import erfa
import numpy as np
import skyfield
from skyfield.api import load, load_file
from skyfield.framelib import ecliptic_frame

kernel, output = map(Path, sys.argv[1:])
digest = hashlib.sha256(kernel.read_bytes()).hexdigest()
expected_digest = "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2"
if digest != expected_digest:
    raise ValueError(f"Unexpected DE440s kernel SHA-256: {digest}")
ts = load.timescale(builtin=True)
eph = load_file(str(kernel))
dates = {dt.date(y, m, 1) for y in range(1850, 2050) for m in range(1, 13)}
dates |= {dt.date(2026, 1, 1) + dt.timedelta(days=i) for i in range(365)}
dates |= {dt.date(2050, 1, 1), dt.date(1900, 8, 5)}
dates = sorted(dates)
# The old and new formula both interpret the supplied day as their dynamical
# argument. Compare at the same TT, isolating orbital/frame error from UTC/TT.
jd = np.array([(date - dt.date(2000, 1, 1)).days + 2451544.5 for date in dates])
t = ts.tt_jd(jd)
matrix = erfa.ecm06(2451545.0, jd - 2451545.0)
j2000 = erfa.ecm06(2451545.0, 0)


def longitudes(vectors):
    return np.degrees(np.arctan2(vectors[:, 1], vectors[:, 0])) % 360


positions = []
for name in ("mercury", "venus", "mars", "jupiter", "saturn"):
    body = eph[name if name in {"mercury", "venus"} else name + " barycenter"]
    vector = (body.at(t).position.au - eph["earth"].at(t).position.au).T
    of_date = longitudes(np.einsum("nij,nj->ni", matrix, vector))
    fixed = longitudes(vector @ j2000.T)
    apparent = eph["earth"].at(t).observe(body).apparent().frame_latlon(ecliptic_frame)[1]
    positions.append({"name": name, "meanOfDate": of_date.tolist(),
                      "j2000": fixed.tolist(), "apparentOfDate": apparent.degrees.tolist()})

# Transform fixed directions with the compiled ERFA matrix implementation.
# Longitude probes avoid the poles, where longitude is undefined.
transforms = []
for year in (1800, 1850, 1900, 1950, 2000, 2026, 2050):
    epoch = (dt.date(year, 1, 1) - dt.date(2000, 1, 1)).days + 2451544.5
    rotation = erfa.ecm06(2451545.0, epoch - 2451545.0) @ j2000.T
    for lon in range(0, 360, 30):
        for lat in (-80, -30, -5, 0, 5, 30, 80):
            l, b = np.radians([lon, lat])
            vector = np.array([np.cos(b) * np.cos(l), np.cos(b) * np.sin(l), np.sin(b)])
            transforms.append({"jd": epoch, "input": vector.tolist(),
                               "expected": (rotation @ vector).tolist()})

result = {
    "source": "JPL DE440s, geometric mean ecliptic of date (ERFA) and apparent true ecliptic of date (Skyfield)",
    "kernel": {"url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
               "sha256": digest, "bytes": kernel.stat().st_size},
    "versions": {"skyfield": skyfield.__version__, "pyerfa": erfa.__version__, "numpy": np.__version__},
    "timescale": "TT; same nominal JD as the formula, not a UTC conversion",
    "dates": [str(date) for date in dates], "jd": jd.tolist(),
    "positions": positions, "transforms": transforms,
}
output.write_text(json.dumps(result, separators=(",", ":")) + "\n")
print(json.dumps({"dates": len(dates), "planetPositions": len(dates) * 5,
                  "transformVectors": len(transforms), "sha256": digest}))
