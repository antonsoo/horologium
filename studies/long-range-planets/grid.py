"""Recreate the nominal JDTDB sample coordinates without product calendar code."""
import json
import math
import sys
from pathlib import Path


def jd(year, month):
    if month <= 2:
        year -= 1
        month += 12
    century = math.floor(year / 100)
    return (math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1))
            + 1 + 2 - century + math.floor(century / 4) - 1524.5)


years = set(range(-2900, 3001, 100)) | {-2999, -2998, -43, 0, 1, 1799, 1800, 2050, 2051, 2999}
values = sorted({jd(y, m) for y in years for m in (1, 4, 7, 10)} | {2451545.0})
Path(sys.argv[1]).write_text(json.dumps({
    'description': 'Proleptic Gregorian year/month labels at fixed JDTDB coordinates; astronomical year numbering. No UTC/TT conversion.',
    'jds': values,
}, indent=2)+'\n')
