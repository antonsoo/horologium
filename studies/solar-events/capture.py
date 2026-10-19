"""Capture independent solar crossings from Skyfield/JPL DE421.

uv run --with skyfield python studies/solar-events/capture.py
The larger working data and downloaded ephemeris stay in ignored cache/.
"""

import hashlib
import importlib.metadata
import json
from pathlib import Path

from skyfield import almanac
from skyfield.api import Loader, wgs84

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).with_name("cache")
load = Loader(str(CACHE))
ts = load.timescale()
eph = load("de421.bsp")
start, end = ts.utc(2025, 12, 30), ts.utc(2027, 1, 3)
sites = [
    {"name": f"grid-{lat}-{lon}", "latitudeDeg": lat, "longitudeDeg": lon}
    for lat in [-89, -80, -70, -67.4, -66.5, -65, 0, 40, 65, 66.5, 67.4, 70, 80, 89]
    for lon in [-179.9, -90, 0, 90, 179.9]
]
sites += [
    {"name": "Rome", "latitudeDeg": 41.9028, "longitudeDeg": 12.4964},
    {"name": "Babylon", "latitudeDeg": 32.5355, "longitudeDeg": 44.4275},
    {"name": "Tromso", "latitudeDeg": 69.6492, "longitudeDeg": 18.9553},
    {"name": "Utqiagvik", "latitudeDeg": 71.2906, "longitudeDeg": -156.7886},
]
for site in sites:
    observer = eph["earth"] + wgs84.latlon(site["latitudeDeg"], site["longitudeDeg"])
    crossings = []
    for rising, finder in [
        (True, almanac.find_risings),
        (False, almanac.find_settings),
    ]:
        times, found = finder(observer, eph["sun"], start, end, horizon_degrees=-0.8333)
        # Skyfield returns a transit placeholder when found=False. It is NOT
        # a rise/set. Retain only the actual modeled horizon crossings.
        for time, exists in zip(times, found):
            if exists:
                crossings.append({"jd": float(time.ut1), "rising": rising})
    site["crossings"] = sorted(crossings, key=lambda row: row["jd"])

provenance = {
    "producer": "Skyfield " + importlib.metadata.version("skyfield"),
    "ephemeris": "JPL DE421",
    "source": "https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp",
    "ephemerisSha256": hashlib.sha256((CACHE / "de421.bsp").read_bytes()).hexdigest(),
    "definition": "topocentric apparent solar center altitude -0.8333 degrees; no weather or elevation model",
    "timeBasis": "UT1 Julian days; UTC approximates UT1 in the application",
}
oracle = {"provenance": provenance, "year": 2026, "sites": sites}
(CACHE / "events.json").write_text(json.dumps(oracle) + "\n")

# Independent reference windows around local mean noon. Selected cases keep
# their crossings well inside each window; these are not app-computed minima.
controls = [
    ("north-short-day", 89, 179.9, "2026-03-16", 360),
    ("south-short-day", -89, 90, "2026-03-25", 600),
    ("first-sunset", -89, -179.9, "2026-03-19", 120),
    ("first-sunrise", -70, 90, "2026-11-18", 60),
    ("phantom-daylight", -89, 90, "2026-09-18", 60),
    ("rome-summer", 41.9028, 12.4964, "2026-06-21", 30),
    ("babylon-winter", 32.5355, 44.4275, "2026-12-21", 30),
    ("east-date-line", 40, 179.9, "2026-03-16", 30),
    ("west-date-line", 40, -179.9, "2026-03-16", 30),
    ("polar-day", 80, 0, "2026-06-21", 30),
    ("polar-night", 80, 0, "2026-12-21", 30),
]
fixtures = []
for name, lat, lon, date, tolerance in controls:
    year, month, day = map(int, date.split("-"))
    jd = float(ts.utc(year, month, day).ut1)
    # Civil midnight is an exact app input; use UTC-like JD, not the small
    # UT1 correction present in ts.utc(...).ut1.
    jd = round(jd * 2) / 2
    mean_noon = jd + 0.5 - lon / 360
    site = next(
        s for s in sites if s["latitudeDeg"] == lat and s["longitudeDeg"] == lon
    )
    events = [e for e in site["crossings"] if abs(e["jd"] - mean_noon) < 0.51]
    fixtures.append(
        {
            "name": name,
            "jd": jd,
            "date": date,
            "latitudeDeg": lat,
            "longitudeDeg": lon,
            "sunriseJD": next((e["jd"] for e in events if e["rising"]), None),
            "sunsetJD": next((e["jd"] for e in events if not e["rising"]), None),
            "toleranceSeconds": tolerance,
        }
    )
output = {"provenance": provenance, "cases": fixtures}
(ROOT / "tests/fixtures/solar-events.json").write_text(
    json.dumps(output, indent=2) + "\n"
)
print(
    json.dumps(
        {
            "sites": len(sites),
            "crossings": sum(len(s["crossings"]) for s in sites),
            "fixtures": len(fixtures),
        }
    )
)
