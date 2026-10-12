"""Independent Moon longitudes and conjunctions from local JPL DE440s.

python oracle.py /path/to/de440s.bsp output.json
Requires skyfield==1.54 numpy==2.4.4 pyerfa==2.0.1.5. No network requests.
"""

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

import erfa
import numpy as np
import skyfield
from skyfield import almanac
from skyfield.api import load, load_file
from skyfield.framelib import ecliptic_frame

kernel, output = map(Path, sys.argv[1:])
digest = hashlib.sha256(kernel.read_bytes()).hexdigest()
if digest != "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2":
    raise ValueError("Unexpected DE440s kernel")
ts = load.timescale(builtin=True)
eph = load_file(str(kernel))
earth, moon = eph["earth"], eph["moon"]
start, end = dt.date(1900, 1, 1), dt.date(2101, 1, 1)
dates = {start + dt.timedelta(days=i) for i in range(0, (end - start).days, 7)}
dates |= {dt.date(2026, 1, 1) + dt.timedelta(days=i) for i in range(365)}
dates = sorted(dates)
jd = np.array([(date - dt.date(2000, 1, 1)).days + 2451544.5 for date in dates])
t = ts.tt_jd(jd)
vectors = (moon.at(t).position.au - earth.at(t).position.au).T
mean_vectors = np.einsum("nij,nj->ni", erfa.ecm06(2451545, jd - 2451545), vectors)
mean_lon = np.degrees(np.arctan2(mean_vectors[:, 1], mean_vectors[:, 0])) % 360
apparent = earth.at(t).observe(moon).apparent().frame_latlon(ecliptic_frame)[1].degrees

events = []
for year in range(1900, 2101, 10):
    times, phases = almanac.find_discrete(ts.tt(year, 1, 1), ts.tt(min(year + 10, 2101), 1, 1), almanac.moon_phases(eph))
    events.extend(float(time.tt) for time in times[phases == 0])
    print(f"Conjunctions through {min(year + 10, 2101) - 1}", flush=True)

# Actual clock inputs use UTC. Keep this separate from the equal-TT model
# comparison; the existing formula does not convert its argument to TT.
utc_dates = [dt.date(2026, 1, 1) + dt.timedelta(days=i) for i in range(365)]
utc_times = ts.utc([date.year for date in utc_dates], [date.month for date in utc_dates], [date.day for date in utc_dates])
utc_apparent = earth.at(utc_times).observe(moon).apparent().frame_latlon(ecliptic_frame)[1].degrees
modern_events = []
for jd_tt in events:
    instant = ts.tt_jd(jd_tt).utc_datetime()
    if instant.year == 2026 or int(jd_tt) in {2458873, 2459848}:
        modern_events.append({"jdTT": jd_tt, "jdUTC": instant.timestamp() / 86400 + 2440587.5,
                              "utc": instant.isoformat()})
result = {
    "kernel": {"url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp", "sha256": digest, "bytes": kernel.stat().st_size},
    "versions": {"skyfield": skyfield.__version__, "numpy": np.__version__, "pyerfa": erfa.__version__},
    "timescale": "TT for model comparisons; UTC under Skyfield builtin leap table for the separate 2026 clock grid",
    "dates": [str(date) for date in dates], "jd": jd.tolist(),
    "meanLongitude": mean_lon.tolist(), "apparentLongitude": apparent.tolist(),
    "newMoonsTT": events,
    "modernConjunctionsUTC": modern_events,
    "clock2026": [{"date": str(date), "jdUTC": (date - dt.date(2000, 1, 1)).days + 2451544.5,
                   "jdTT": float(time.tt), "apparentLongitude": float(lon)}
                  for date, time, lon in zip(utc_dates, utc_times, utc_apparent, strict=True)],
}
output.write_text(json.dumps(result, separators=(",", ":")) + "\n")
print(json.dumps({"positions": len(dates), "conjunctions": len(events), "clockUTC": len(utc_dates)}))
