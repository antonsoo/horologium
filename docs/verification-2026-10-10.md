# Calendar source verification, 2026-10-10

A fresh archive of `9be8c39d3ce1138491df752c9a9b11015cffe077` was verified
before pushing the Chinese civil-day corrections and lunar-year inspector.
These source changes do not publish an updated npm package.

All 200 pinned HKO tables were rechecked by size and SHA-256: 5,476,893
bytes. The source build and separately installed packed library on Node
26.7.0 and 20.0.0 produced the same complete daily report, apart from run
duration. That report also equals the [retained comparison](../studies/chinese-calendar/results.json):

| Observation | Fresh result |
| --- | ---: |
| Comparable dates, 1901-2100 | 73,029 |
| Midnight/noon/final-second samples | 219,087 |
| Modern dates, 1929-2100 | 62,821 |
| Modern calendar discrepancies | 0 |
| Retained historical discrepancies | 90 |
| Unexpected discrepancies | 0 |
| Inconsistent civil days | 0 |
| Complete inspected lunar years / months | 199 / 2,461 |

The missing 2069 source day, 19 initially unlabelled days, three historical
month-start shifts and ten approximate solar-term date differences remain
explicit. The fresh event comparison against the retained JPL/Skyfield
fixture reproduces the maxima of 17.1641 seconds for 2,487 conjunctions
and 831.5005 seconds for 2,412 principal terms. The ephemeris fixture itself
was not regenerated in this run. These are TT comparisons, not validation
of future UTC or historical calendar reforms.

The clean Node 26.7.0/npm 12.0.1 install passed lint, strict types, 217
tests in each of the default and German locales, library/site builds,
and 56 Chromium/Firefox workflows. Both documented JS examples ran.
The actual 2033 browser download equals the public inspection API;
desktop and 375-pixel dark ledger captures were opened and inspected.
The [verification manifest](evidence/source-2026-10-10/verification.json)
records the package hash, build hashes and current measurements.

The [study](../studies/chinese-calendar/README.md) and
[initial application record](verification-2026-10-08.md) give reproduction
commands and the model's limits. This record establishes source and local
installed behavior; it does not assert a new npm or hosted release.
