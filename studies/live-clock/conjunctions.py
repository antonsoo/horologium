"""Fresh independent UTC conjunctions for the two visible calendar counterexamples.

python conjunctions.py /path/to/de440s.bsp output.json
Requires skyfield==1.54 and numpy==2.4.4. The verified kernel is local; no network.
This checks the app's stated mean-midnight reconstruction, not ancient sightings.
"""
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy
import skyfield
from skyfield import almanac
from skyfield.api import load, load_file

kernel, output = map(Path, sys.argv[1:])
digest = hashlib.sha256(kernel.read_bytes()).hexdigest()
assert digest == "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2"
ts = load.timescale(builtin=True)
ephemeris = load_file(str(kernel))
rows = []
for name, start, end, longitude, clock_jd in [
    ("babylonian-2020", (2020, 1, 23), (2020, 1, 27), 44.4275, 2458873.876590278),
    ("greek-2022", (2022, 9, 24), (2022, 9, 28), 23.7275, 2459848.9340902776),
]:
    times, phases = almanac.find_discrete(ts.utc(*start), ts.utc(*end), almanac.moon_phases(ephemeris))
    events = list(times[phases == 0])
    assert len(events) == 1
    event = events[0]
    instant = event.utc_datetime()
    utc_jd = instant.timestamp() / 86400 + 2440587.5
    event_day = math.floor(utc_jd + longitude / 360 + 0.5)
    clock_day = math.floor(clock_jd + longitude / 360 + 0.5)
    rows.append({"id": name, "utc": instant.isoformat(), "jdUTC": utc_jd, "jdTT": float(event.tt),
                 "longitudeDegEast": longitude, "clockJD": clock_jd, "conjunctionMeanDay": event_day,
                 "clockMeanDay": clock_day, "expectedDayInModeledMonth": clock_day - event_day + 1})
record = {"checkedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
          "kernel": {"url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp", "sha256": digest, "bytes": kernel.stat().st_size},
          "versions": {"skyfield": skyfield.__version__, "numpy": numpy.__version__},
          "timeBasis": "Apparent geocentric Sun/Moon conjunction found in dynamical time, converted to past UTC with Skyfield's built-in leap-second table; then apply the project's fixed longitude and mean-midnight rule",
          "events": rows}
output.write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(rows, indent=2))
