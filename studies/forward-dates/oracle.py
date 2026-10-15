"""Pinned independent month boundaries; run with convertdate==2.4.0.

python oracle.py > months.json
No project code is imported. Ethiopian uses the Coptic year offset (-276),
whose modern epoch/month labels are separately checked against native ICU.
"""
import hashlib
import inspect
import json
from pathlib import Path
import convertdate
from convertdate import gregorian, julian, hebrew, islamic, coptic
assert convertdate.__version__ == "2.4.0"
modules = [gregorian, julian, hebrew, islamic, coptic]
civil_years = [-4800, -4000, -100, -1, 0, 1, 4, 100, 400, 1582, 1600, 1700, 1800, 1900, 2000, 2024, 2025, 2100, 2400, 5000, 10000]
coptic_years = [-3000, -4, -1, 0, 1, 2, 3, 4, 99, 100, 1739, 1740, 1741, 2015, 2016, 2017, 5000]
rows = []
for name, module, years in [
    ("gregorian", gregorian, civil_years), ("julian", julian, civil_years),
    ("hebrew", hebrew, list(range(1, 20)) + [3761, 5000, 5779, 5784, 5785, 5790, 6000, 10000]),
    ("islamic", islamic, [-200, -1, 0] + list(range(1, 31)) + [1000, 1445, 1446, 2000]),
    ("coptic", coptic, coptic_years), ("ethiopian", coptic, coptic_years),
]:
    for year in years:
        mapped_year = year - 276 if name == "ethiopian" else year
        count = hebrew.year_months(year) if name == "hebrew" else 13 if module is coptic else 12
        for month in range(1, count + 1):
            days = hebrew.month_days(year, month) if name == "hebrew" else module.month_length(mapped_year, month)
            jd = module.to_jd(mapped_year, month, 1)
            rows.append([name, year, month, days, jd])
metadata = {"oracle": "convertdate", "version": convertdate.__version__,
 "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 "module_sha256": {m.__name__: hashlib.sha256(Path(inspect.getfile(m)).read_bytes()).hexdigest() for m in modules},
 "fields": ["calendar", "year", "month", "days", "month_start_jd"],
 "ethiopian_reference": "Coptic calendar with year offset -276; native ICU checks retained by replay.mjs",
}
header = json.dumps(metadata, indent=2)[:-2]
records = ",\n".join("    " + json.dumps(row, separators=(", ", ": ")) for row in rows)
print(header + ',\n  "months": [\n' + records + '\n  ]\n}')
