# Refuse an impossible date instead of converting another one

Forward conversion at source baseline `aa6810cd65010158c37e63392ce78fd82abaa35c`
accepts nonexistent month/day tuples. The returned Julian Day is plausible, but
belongs to another date. These reproduce through a locally packed and installed
package, rather than just an internal helper:

| Supplied date | Baseline interpretation | Corrected result |
| --- | --- | --- |
| Gregorian 2025-02-29 | 2025-03-01 | RangeError |
| Julian 1900-02-30 | 1900-03-01 | RangeError |
| Hebrew 5784, Cheshvan 30 | Kislev 1 | RangeError |
| Coptic 1740, month 13 day 6 | Next year, month 1 day 1 | RangeError |
| Ethiopian 2016, month 13 day 6 | Next year, month 1 day 1 | RangeError |
| Islamic tabular 1445, Safar 30 | Rabi' al-awwal 1 | RangeError |
| Egyptian year 1, epagomenal day 6 | Next year, month 1 day 1 | RangeError |
| Zoroastrian 1395, Gatha day 6 | Next year, month 1 day 1 | RangeError |

The [earlier date-input correction](../date-inputs/README.md) bounds inverse
calculations and explicitly left forward field validation incomplete. This adds
that boundary for Gregorian/Julian, Hebrew, Islamic tabular, Coptic/Ethiopian,
Egyptian and Zoroastrian conversion. Roman and Byzantine wrappers inherit the
checked underlying Julian fields, as their existing forward contract specifies.
Maya positional counts and the astronomical calendars are outside this change.

## Behavior and compatibility

Years must be safe integers; astronomical year zero and negative years remain
available. Month numbers must identify a month in that year, including Hebrew
leap-month membership. A supplied day must fit that particular month. Whole-day
arithmetic must establish an exact midnight and the following midnight.

Fractional days remain supported within an existing day, including the final
day of a month: for example, Gregorian `2024-02-29.5` is leap day at noon.
The original calculation expressions remain unchanged; a separate whole-day
evaluation checks precision when necessary. Invalid dates raise `RangeError`
without generating a substitute date.

This changes callers that intentionally used day zero, month 13 in a 12-month
calendar, or another overflow tuple for date arithmetic. Add an offset to a
valid Julian Day instead:

```js
import { core } from '@antonsoloviev/horologium';

const nextDay = core.gregorianToJD(2025, 2, 28) + 1;
core.jdToGregorian(nextDay); // { year: 2025, month: 3, day: 1 }
```

The source correction is unreleased. These input checks do not change a
calendar's historical status, the Islamic moon-sighting caveat, or astronomical
accuracy. Invalid fields do not establish a historical date.

## Independent boundaries and actual package replay

[`oracle.py`](oracle.py) imports convertdate 2.4.0 in an isolated Python
environment and records 1,726 month starts/lengths in [`months.json`](months.json).
It pins the generator and all five reference-module hashes. Gregorian/Julian
controls include astronomical year zero, BCE years, century leap rules and wider
arithmetic years. Hebrew covers a complete Metonic cycle plus modern variable
Cheshvan/Kislev and leap-month boundaries; Islamic controls cover its 30-year
cycle. Coptic/Ethiopian controls include short epagomenal months and leap days.

The reference's [Hebrew month lengths](https://convertdate.readthedocs.io/en/latest/modules/hebrew.html),
[Coptic short month](https://convertdate.readthedocs.io/en/latest/modules/coptic.html)
and [Islamic month lengths](https://convertdate.readthedocs.io/en/latest/modules/islamic.html)
are checked through a separate implementation. Ethiopian records use its Coptic
year offset of -276; 984 separate modern native ICU comparisons check that
epoch and month mapping. Shared calendrical theory is not an independent
historical attestation.

[`replay.mjs`](replay.mjs) calls the actual public library entry points. It
checks month starts, final days and exact quarter-day fractions against 8,920
independent expected JDs. Further valid controls include nonbinary fractions and
the project's fixed 365-day models. All 16,884 valid outputs have the same exact
digest before and after. Native ICU agrees in all 984 Ethiopian cases.

The 2,623 deliberately invalid requests cover the first nonexistent day of
every sampled month, invalid year/month/day types, nonfinite values, unsafe
years, unrepresentable dates and an absent Hebrew leap month. The baseline
refuses 16; the correction refuses all 2,623. Every request is followed by a
valid conversion in the same process, and all 2,623 recover. These are constructed
inputs, not claimed production incidents.

Receipts retain every invalid request, its actual result/refusal, recovery,
module hashes, runtime and input/driver hashes:
[before](results/before.json), [after](results/after.json).
Packed-artifact, clean-build and browser checks are retained in
[verification](results/verification.json).

```sh
npm ci
npm run build:lib
node examples/forward-dates.mjs
node studies/forward-dates/replay.mjs --library dist/lib/index.js --out forward-replay.json
```

To retain baseline disagreements, add `--observe-only` and point `--library` at
the original package's installed `dist/lib/index.js`. Regenerate the reference
with `convertdate==2.4.0` and
`python studies/forward-dates/oracle.py > studies/forward-dates/months.json`;
the normal package has no Python/reference-library dependency.
