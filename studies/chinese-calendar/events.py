"""Independent new-moon / principal-term instants from Skyfield and JPL DE440s.

Run with: uv run --with skyfield==1.54 --with numpy==2.4.4 python studies/chinese-calendar/events.py
The binary ephemeris is cached locally and its hash recorded with the fixture.
All comparisons use TT to separate orbital-model error from predicted Earth rotation.
"""

import hashlib
import json
from pathlib import Path

import numpy as np
import skyfield
from skyfield import almanac
from skyfield.api import Loader
from skyfield.framelib import ecliptic_frame

ROOT = Path(__file__).resolve().parent
load = Loader(str(ROOT / ".cache"))
ts = load.timescale(builtin=True)
eph = load("https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp")
path = ROOT / ".cache/de440s.bsp"
digest = hashlib.sha256(path.read_bytes()).hexdigest()
fixture = ROOT / "events.json"
if fixture.exists() and digest != json.loads(fixture.read_text())["sha256"]:
    raise ValueError(
        "DE440s differs from the pinned ephemeris; refusing to regenerate the fixture"
    )


def principal_term(t):
    earth_to_sun = eph["earth"].at(t).observe(eph["sun"]).apparent()
    _, longitude, _ = earth_to_sun.frame_latlon(ecliptic_frame)
    return (longitude.degrees // 30).astype(int) % 12


principal_term.step_days = 10
moons = []
terms = []
for year in range(1900, 2101, 10):
    end_year = min(year + 10, 2101)
    start, end = ts.tt(year, 1, 1), ts.tt(end_year, 1, 1)
    times, phases = almanac.find_discrete(start, end, almanac.moon_phases(eph))
    for t in times[phases == 0]:
        k = int(np.rint((t.tt - 2451550.09766) / 29.530588861))
        moons.append([k, float(t.tt)])
    times, sectors = almanac.find_discrete(start, end, principal_term)
    terms.extend(
        [int(sector) * 30, float(t.tt)]
        for sector, t in zip(sectors, times, strict=True)
    )
    print(f"Computed events through {end_year - 1}", flush=True)

result = {
    "source": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
    "sha256": digest,
    "bytes": path.stat().st_size,
    "skyfield": skyfield.__version__,
    "numpy": np.__version__,
    "timeScale": "TT",
    "start": "1900-01-01",
    "endExclusive": "2101-01-01",
    "newMoons": moons,
    "principalTerms": terms,
}
(ROOT / "events.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
print(f"Wrote {len(moons)} new moons and {len(terms)} principal solar terms")
