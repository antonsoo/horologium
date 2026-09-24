#!/usr/bin/env python3
"""Generate oracle reference fixtures for horologium's calendar tests.

Cross-checks this project's TypeScript calendar arithmetic against
independent, third-party implementations:
  - convertdate (https://github.com/fitnr/convertdate) for Hebrew, Islamic,
    Coptic, and Mayan (Long Count) calendars, and Julian<->Gregorian<->JD
    conversions.
  - lunardate (https://github.com/lidatong/lunardate) for Chinese New Year
    dates.

Setup (creates a throwaway venv, does not touch the project's own deps):
    uv venv /tmp/horologium-oracle
    uv pip install --python /tmp/horologium-oracle/bin/python \\
        convertdate lunardate skyfield

Run:
    uv run --python /tmp/horologium-oracle/bin/python \\
        scripts/generate_fixtures.py

Writes JSON files to tests/fixtures/. These are pure data: the TypeScript
test suite reads them and asserts our implementation reproduces them
exactly (Hebrew, Islamic, Coptic, Mayan, gregorian/julian/jd) or within a
documented tolerance (Chinese New Year, which both sides compute
astronomically and can legitimately differ by root-finding precision).
"""

import datetime
import json
import os
import random

import convertdate.coptic as cd_coptic
import convertdate.gregorian as cd_gregorian
import convertdate.hebrew as cd_hebrew
import convertdate.islamic as cd_islamic
import convertdate.julian as cd_julian
import convertdate.julianday as cd_jd
import convertdate.mayan as cd_mayan
from lunardate import LunarDate

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures")
os.makedirs(FIXTURES_DIR, exist_ok=True)

random.seed(20260924)  # today's date, for reproducibility


def write(name, data):
    path = os.path.join(FIXTURES_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {path} ({len(data)} entries)")


def sample_gregorian_dates(n, year_lo, year_hi):
    """n pseudo-random valid Gregorian calendar dates in [year_lo, year_hi]."""
    out = []
    seen = set()
    while len(out) < n:
        y = random.randint(year_lo, year_hi)
        m = random.randint(1, 12)
        d = random.randint(1, 28)  # 28 is valid in every month, avoids edge-case handling here
        key = (y, m, d)
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


# --- Gregorian / Julian / JD (astronomical year numbering check) ----------
gregorian_jd = []
for y, m, d in sample_gregorian_dates(150, 1, 2400):
    jd = cd_jd.from_gregorian(y, m, d)
    gregorian_jd.append({"year": y, "month": m, "day": d, "jd": jd})
write("gregorian-jd.json", gregorian_jd)

julian_jd = []
for y, m, d in sample_gregorian_dates(150, 1, 2400):
    jd = cd_jd.from_julian(y, m, d)
    julian_jd.append({"year": y, "month": m, "day": d, "jd": jd})
write("julian-jd.json", julian_jd)

# --- Hebrew ------------------------------------------------------------
hebrew = []
for y, m, d in sample_gregorian_dates(200, 1, 2400):
    jd = cd_jd.from_gregorian(y, m, d)
    hy, hm, hd = cd_hebrew.from_gregorian(y, m, d)
    hebrew.append({"gregorian": [y, m, d], "jd": jd, "hebrew": [hy, hm, hd]})
write("hebrew.json", hebrew)

# --- Islamic (tabular) ---------------------------------------------------
islamic = []
for y, m, d in sample_gregorian_dates(200, 1, 2400):
    jd = cd_jd.from_gregorian(y, m, d)
    iy, im, id_ = cd_islamic.from_gregorian(y, m, d)
    islamic.append({"gregorian": [y, m, d], "jd": jd, "islamic": [iy, im, id_]})
write("islamic.json", islamic)

# --- Coptic ----------------------------------------------------------------
coptic = []
for y, m, d in sample_gregorian_dates(200, 1, 2400):
    jd = cd_jd.from_gregorian(y, m, d)
    cy, cm, cd_ = cd_coptic.from_gregorian(y, m, d)
    coptic.append({"gregorian": [y, m, d], "jd": jd, "coptic": [cy, cm, cd_]})
write("coptic.json", coptic)

# --- Mayan Long Count --------------------------------------------------
mayan = []
for y, m, d in sample_gregorian_dates(200, 1, 2400):
    jd = cd_jd.from_gregorian(y, m, d)
    baktun, katun, tun, winal, kin = cd_mayan.from_jd(jd)
    mayan.append(
        {
            "gregorian": [y, m, d],
            "jd": jd,
            "longCount": {"baktun": baktun, "katun": katun, "tun": tun, "winal": winal, "kin": kin},
        }
    )
write("mayan.json", mayan)

# --- Chinese New Year, 2000-2030 (explicitly required by the project brief) -
chinese_new_year = []
for y in range(2000, 2031):
    g = LunarDate(y, 1, 1).to_solar_date()
    chinese_new_year.append({"chineseYear": y, "gregorian": [g.year, g.month, g.day]})
write("chinese-new-year.json", chinese_new_year)

# --- Chinese lunar month boundaries, 2000-2035 (catches leap-month edge --
# cases like 2014's leap 9th month, where a solar term and a new moon land
# on the same civil day) --------------------------------------------------
chinese_months = []
d = datetime.date(2000, 1, 1)
prev_key = None
while d < datetime.date(2036, 1, 1):
    ld = LunarDate.fromSolarDate(d.year, d.month, d.day)
    key = (ld.year, ld.month, ld.isLeapMonth)
    if key != prev_key:
        chinese_months.append(
            {
                "gregorian": [d.year, d.month, d.day],
                "chineseYear": ld.year,
                "chineseMonth": ld.month,
                "isLeapMonth": bool(ld.isLeapMonth),
            }
        )
        prev_key = key
    d += datetime.timedelta(days=1)
write("chinese-month-boundaries.json", chinese_months)

print("done")
