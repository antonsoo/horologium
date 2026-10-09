# Chinese calendar: daily labels and event evidence

This study compares the actual calendar library with primary HKO daily
tables and separately checks astronomical events against JPL DE440s. It
does not use the HKO tables as the runtime calendar implementation.

## Daily comparison

The [source manifest](sources.json) pins all 200 HKO annual text files for
1901–2100 by URL, byte count and SHA-256 (5,476,893 bytes total). The parser
checks date order, weekdays, day progression, 29/30-day month lengths,
month-number progression, repeated-month labels and complete year ends.
The source filenames and line numbers accompany every differing date in
[results.json](results.json).

There are 73,048 source rows. The 2069 text file goes directly from
29 December to 31 December: **30 December 2069 is missing**. The first
19 rows in 1901 precede the first explicit lunar-month label; no label is
invented for those rows. That leaves 73,029 dates whose full lunar labels
can be derived from the source, from 20 January 1901 through 31 December
2100. Repeated month numbers identify leap months in these text tables.

Every comparable date is evaluated at local midnight, noon and the final
second: 219,087 instants. Ganzhi day names are separately checked by date
arithmetic from the 27 January 2019 *jiǎzǐ* anchor in
[Y. T. Liu, equation (1)](https://ytliu0.github.io/ChineseCalendar/sexagenary.html);
HKO's daily text files do not themselves provide Ganzhi day names.

| Check | Original `43d6721` | Revised calculation |
| --- | ---: | ---: |
| Different month/day/year, 1929–2100 (62,821 available dates) | 1,315 | 0 |
| Different month/day/year, entire comparable corpus | 1,628 | 90 |
| Wrong Ganzhi day against the stated anchor | 73,029 | 0 |
| Calendar date changes within one UTC+8 civil day | 201 | 0 |

[baseline.json](baseline.json) records the original library rebuilt from a
detached worktree, using the same source files and three daily sample instants.
Counts are per date, not per failing assertion. The revised report retains
the 90 mismatches, rather than counting them as matches:

| Published month start | UTC+8 model start | Affected source dates |
| --- | --- | ---: |
| 17 November 1914 | 18 November 1914 | 30 |
| 3 February 1916 | 4 February 1916 | 30 |
| 10 November 1920 | 11 November 1920 | 30 |

These are the three historical Beijing-time discrepancies described in
[Liu's calculation notes](https://ytliu0.github.io/ChineseCalendar/computation.html).
The library deliberately identifies itself as a modern-rule UTC+8
projection, without claiming historical Beijing time or earlier calendar
reforms. The verifier only classifies these exact one-day shifts as
explained; other differences fail verification.

The original errors included a false leap month 7 in 2033, a missed first
day of 2027's New Year, a year that changed at conjunction instead of
midnight, and a wrong sexagenary-day epoch. The older lunardate fixture
also contained **446 actual month starts plus a starting sample on lunar
day 25**, not 447 month starts. Its day values are now recorded and checked.

## Year inspection and solar-term limits

The exported inspection is checked for 199 complete lunar years
(1901–2099), containing 2,461 months. Month starts differ only in the
three historical cases above. Civil intervals are contiguous; event
instants fall within the stated day intervals; no boundary inconsistency
was found.

Ten principal-solar-term civil dates differ from HKO. Six occur from
1929 onward and all six are flagged as within 15 minutes of local
midnight. The earlier differences include historical clock/ephemeris
conventions; the 1912 Minor Snow difference is not flagged, reinforcing
that the threshold is not an error bound. Every difference is listed in
`results.json`, including the unflagged one.

## Independent event timing

[events.py](events.py) uses Skyfield 1.54, NumPy 2.4.4 and JPL's
[DE440s binary ephemeris](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp).
It finds apparent geocentric lunar conjunctions and 30-degree solar
longitude crossings using numerical integration data, independently of
the runtime Meeus formulas. The binary's hash and the derived events are
pinned in [events.json](events.json); regenerating refuses a changed
binary. The runtime has no Python, Skyfield or ephemeris dependency.

| Events in 1900–2100 | Compared | Largest TT difference |
| --- | ---: | ---: |
| New moons | 2,487 | 17.1641 seconds |
| Principal solar terms | 2,412 | 831.5005 seconds (13.86 minutes) |

[event-results.json](event-results.json) records the worst events. These
are comparisons in **Terrestrial Time**. They do not validate the
Espenak–Meeus Delta-T predictions, future UTC, or an ancient calendar's
historical decisions. Runtime solar-term times remain approximate.

## Reproduce

Use Node 24 and Python 3.10 or later. The daily verifier uses only Python's
standard library and the built JS library:

```sh
npm ci
npm run build:lib
python3 studies/chinese-calendar/fetch.py
python3 studies/chinese-calendar/verify.py
node studies/chinese-calendar/verify-events.mjs
```

The first fetch downloads the pinned annual files to the ignored `.cache/`
directory; subsequent runs verify their hashes. Missing, changed or
unexpectedly truncated sources fail. `--cache PATH` can point both Python
commands to another cache. `verify.py --module PATH --output PATH` can
compare an installed package's `dist/lib/index.js`. `--allow-mismatches`
exists for measuring an old revision; it is not used to validate the
revised package.

To regenerate the independent event fixture (downloads the 32,726,016-byte
ephemeris on first use):

```sh
uv run --with skyfield==1.54 --with numpy==2.4.4 python studies/chinese-calendar/events.py
node studies/chinese-calendar/verify-events.mjs
```

Timings in the reports are incidental run durations, not performance
claims. None of the comparison artifacts establishes a published release.
