# Calendars

One section per calendar system this library implements: epoch, structure,
rules, sources, and accuracy. Everything is keyed on Julian Day (JD),
fractional, referenced to UTC noon. Year numbering is **astronomical**
throughout (year 0 = 1 BCE, year -1 = 2 BCE, ...); see `displayYear` in
`src/lib/core/jd.ts` for BCE/CE rendering.

Primary sources for the calendrical arithmetic: Edward M. Reingold & Nachum
Dershowitz, *Calendrical Calculations: The Ultimate Edition* (Cambridge
University Press, 2018). For astronomy: Jean Meeus, *Astronomical
Algorithms*, 2nd ed. (Willmann-Bell, 1998). Both are cited per-function in
the source; this document doesn't repeat every citation, just the epoch and
rule for each system plus anything specific to a narrower source.

## Julian Day and the proleptic calendars (`src/lib/core/jd.ts`)

JD is the number of days since noon UTC, 1 January 4713 BCE (proleptic
Julian calendar). `gregorianToJD`/`jdToGregorian` and `julianToJD`/
`jdToJulian` implement Meeus (1998) ch. 7's algorithm, applied uniformly
(no branch at the 1582 reform) to get proleptic behavior in both
directions. Verified against Meeus's own worked example (JD 2436116.31 for
the Sputnik 1 launch) and against `convertdate` over a wide date spread
(`tests/oracle-fixtures.test.ts`).

## Roman (Julian) civil calendar (`src/lib/roman.ts`)

Reckoned in the Julian calendar as used from the 45 BCE reform onward; the
pre-reform Republican calendar (with its irregular intercalary month) is
out of scope.

- **Kalends/Nones/Ides**: Kalends = 1st of the month. Ides = 15th (March,
  May, July, October) or 13th (all other months). Nones = 8 days before
  Ides by inclusive Roman counting (7th or 5th). Days between named points
  are counted inclusively backward ("a.d. VIII Kal. Oct." = the 8th day
  before the Kalends of October, counting both ends), with `pridie` as a
  special case for the day immediately before, and the bissextile
  (doubled) leap day inserted before a.d. VI Kal. Mart.
- **AUC year**: Varronian epoch, 753 BCE = AUC 1 (`aucYear = astronomicalYear + 753`).
- **Latin weekday**: the later 7-day planetary week (dies Solis ... dies
  Saturni). The Republican/early-Imperial 8-day *nundinal* cycle (a
  different, market-day system, lettered A-H) is not implemented; the
  7-day week only became standard from roughly the 1st-3rd centuries CE, so
  labeling every date this way is itself a simplification for dates before
  then.
- **Seasonal hours**: 12 unequal daylight horae and 4 night vigiliae,
  computed by dividing the real sunrise-to-sunset (and sunset-to-sunrise)
  span at a chosen location into equal parts. Default location: Rome
  (41.9028N, 12.4964E).
- **Accuracy**: calendar arithmetic is exact (pure integer/modular math).
  Seasonal hours depend on `sunTimes` (see Astronomy below): accurate to a
  few minutes near the present, and *not* corrected for Delta-T (the slow
  drift between civil time and Earth's actual rotation), so ancient hour
  boundaries can be off by minutes and this error grows over millennia.

## Byzantine Anno Mundi and the Indiction (`src/lib/byzantine.ts`)

Epoch: 1 September 5509 BCE (Julian calendar); the year begins 1 September.
`amYear = julianYear + 5509` for dates on/after 1 September, `+5508`
before. The Indiction is an unrelated, repeating 15-year cycle (originally
a Roman tax-assessment cycle), epoch 1 September 312 CE = Indiction 1, also
with a September rollover. Purely arithmetic; no accuracy caveats beyond
Julian-calendar arithmetic itself.

## Islamic tabular (civil) calendar (`src/lib/islamic.ts`)

Epoch: 1 Muharram AH 1 = 16 July 622 CE (Julian), JD 1948439.5. 12 months
alternating 30/29 days; a 30-year cycle with 11 leap years (positions 2, 5,
7, 10, 13, 16, 18, 21, 24, 26, 29 of the cycle) adds a day to the 12th
month, Dhu al-Hijjah. This is the widely-used civil/tabular scheme (the one
`convertdate` and several other libraries implement); it is **not** the
religiously-observed calendar, which depends on physical moon-sighting and
can differ from this arithmetic by a day or two in either direction.
Verified exactly against `convertdate` across 200 dates spanning ~2400
years (`tests/oracle-fixtures.test.ts`).

## Coptic and Ethiopian calendars (`src/lib/coptic.ts`)

Both: 12 months of 30 days + a 5-day (6 in a leap year) epagomenal 13th
month, on the same leap-year cycle as the Julian calendar.

- **Coptic**: Era of the Martyrs, 1 Thout AM 1 = 29 August 284 CE (Julian).
- **Ethiopian**: Anno Mundi, 1 Meskerem year 1 = 29 August 8 CE (Julian) - a
  ~7.5-year offset from the Coptic epoch, reflecting a different
  Annunciation-era reckoning. Verified against the well-known modern fact
  that Ethiopian New Year falls around 11 September (12 September in the
  Gregorian year before a Gregorian leap year).

Both verified against `convertdate`'s Coptic implementation and internal
brute-force month enumeration; purely arithmetic, no accuracy caveats.

## Hebrew calendar (`src/lib/hebrew.ts`)

Exact rabbinic arithmetic (Maimonides' codification, in continuous use
since the 12th century CE), not a modern reconstruction.

- **Molad** (mean lunar conjunction): interval exactly 29 days, 12 hours,
  793 *parts* (1 hour = 1080 parts; ~29.530594 days - very slightly longer
  than the true mean synodic month, which is why the rabbinic calendar
  slowly drifts from the astronomical mean Moon over millennia). Epoch
  molad ("BaHaRaD"): 2 days, 5 hours, 204 parts after the calendar epoch
  (proleptically 7 October 3761 BCE, Julian, a Monday).
- **Leap years**: the 19-year Metonic cycle, years 3, 6, 8, 11, 14, 17, 19
  of each cycle (closed form: `(7y + 1) mod 19 < 7`).
- **Dehiyyot** (Rosh Hashanah postponement rules), all four implemented:
  Molad Zaken, Lo ADU Rosh, GaTaRaD, and BeTuTeKaFot.
- **Month lengths**: fixed except Cheshvan/Kislev (29 or 30 days each),
  derived from the measured year length between consecutive Rosh Hashanahs.
- **Hebrew-letter numerals**: standard additive gematria with the
  religiously-motivated substitution of tet-vav/tet-zayin (ט"ו / ט"ז) for
  15/16, avoiding the divine-name-adjacent yod-heh/yod-vav.
- **Accuracy**: exact arithmetic, verified against known Gregorian dates for
  Rosh Hashanah 5785 (3 October 2024) and Passover 5784 (23 April 2024),
  and against `convertdate` across 200 dates spanning ~2400 years.

## Egyptian civil calendar (`src/lib/egyptian.ts`)

A 365-day "wandering" year with no leap day: 12 months of 30 days (3
seasons of 4 months each - Akhet/inundation, Peret/growing,
Shemu/harvest), plus 5 epagomenal days. Counted in the **Era of
Nabonassar** as Ptolemy's astronomical tables did: epoch 1 Thoth, year 1 =
26 February 747 BCE (Julian); this library's own `julianToJD(-746, 2, 26)`
computation lands at JD 1448637.5 (the commonly-cited figure, JD 1448638,
uses a noon-referenced JDN convention rather than this library's midnight
reference - not a discrepancy in the date itself). Month names are the
Greek-derived forms used by ancient astronomers (Thoth, Phaophi, ...).
Egyptian hieroglyphic season signs are **not** rendered: getting a
Gardiner-sign-to-Unicode mapping wrong would be worse than omitting it, and
this project didn't have a way to verify one with confidence in the time
available.

**Sothic cycle**: the civil year drifts about 1 day every 4 years against
the ~365.25-day Sothic (heliacal-rising-of-Sirius) year, realigning every
~1460 years. `sothicCyclePosition` anchors on Censorinus's report (*De Die
Natali*, 238 CE) that 1 Thoth coincided with Sirius's heliacal rising in a
year equivalent to 139 CE - an ancient literary claim this project takes as
given (it is not re-derived from any astronomical computation here), cross-
checked only for internal arithmetic consistency: 139 CE minus one full
cycle (1460 years) lands at 1322 BCE, matching the anchor conventionally
cited elsewhere for the start of the current Sothic cycle.

## Maya calendar (`src/lib/maya.ts`)

- **Long Count**: base-20 (base-18 at the *tun* place) positional count:
  kin (1 day) - winal (20 kin) - tun (18 winal = 360 days) - katun (20 tun)
  - baktun (20 katun). GMT correlation constant (JD of 0.0.0.0.0): default
  **584283** (the modern scholarly consensus), with **584285** selectable.
- **Tzolk'in**: 260-day cycle, 13 numbers x 20 named days.
- **Haab'**: 365-day "vague year", 18 months of 20 days + 5-day Wayeb'.
- **Lord of the Night (G1-G9)**: a 9-day repeating cycle; the correspondence
  of specific residues to G1..G9 is a widely-used convention, not a
  universally settled one among epigraphers.
- **Verified against** the two canonical reference points: 13.0.0.0.0 = 4
  Ajaw 3 K'ank'in = 21 December 2012 (Gregorian), and the creation date
  0.0.0.0.0 = 4 Ajaw 8 Kumk'u - both exact - plus 200 dates cross-checked
  against `convertdate`'s Mayan module.

## Chinese calendar (`src/lib/chinese.ts`)

- **Sexagenary cycle** (year and day): 10 Heavenly Stems x 12 Earthly
  Branches = 60 combinations, each with a pinyin name, element, yin/yang,
  and (for branches) zodiac animal. Day: the plain (UT) Julian Day Number
  mod 60, using the calendrical-literature convention that JD 0 is *jiǎzǐ*.
  Year: `(nominalYear - 4) mod 60`, verified against the well-known fact
  that 1984 is a *jiǎzǐ* year.
- **Lunisolar month/day**: this is an explicit **reconstruction**, computed
  astronomically in China Standard Time (UTC+8) rather than read from a
  historical table. Months run new-moon to new-moon; the month containing
  the December solstice is month 11; when a winter-solstice-to-winter-
  solstice span needs 13 lunar months, the first month (after month 11)
  containing no *zhongqi* (major solar term - a multiple-of-30-degree solar
  longitude crossing) becomes a leap month, repeating the previous month's
  number. New moons and solar terms are root-found on this project's own
  Sun/Moon longitude formulas (see Astronomy below), not read from a table.
  A day-boundary subtlety worth noting: the zhongqi/new-moon comparison is
  evaluated at the *start* of each civil day (China Standard Time), not at
  the exact instant of either event, because several real leap months
  (2014's leap 9th month, 2020's leap 4th month) have a solar term and the
  bounding new moon landing on the same civil day - see the
  `zhongqiBucketForLocalDay` comment in `src/lib/chinese.ts`.
- **Accuracy**: cross-checked against `lunardate` for Chinese New Year every
  year 2000-2030 (max deviation 0.7 days) and against 447 month/leap-month
  boundary dates 2000-2035 (agreement on 439/447 = 98.2%). The 8
  disagreements are of two well-understood kinds, not blind spots: (1)
  boundary dates within about a day of our new-moon timing's own precision
  limit, and (2) 2033, a year where real-world Chinese calendar
  implementations genuinely disagree with each other on where the leap
  month falls (two candidate zhongqi-less months occur close together that
  year) - see `tests/oracle-fixtures.test.ts` for the detail and citation.

## Zoroastrian (Yazdegerdi) calendar (`src/lib/zoroastrian.ts`)

The traditional (Qadimi) reckoning: the same 12x30+5, no-leap-day
structure as the Egyptian civil calendar, epoch 16 June 632 CE (Julian) -
Yazdegerd III's accession. Not a reconstruction (attested arithmetic), but
per-day names within each month (a real, separate 30-name tradition,
several of which repeat the 12 month names) are deliberately not rendered:
this project could not verify the exact name/order list with confidence
in the time available, and a wrong name is worse than a plain number.

## Greek (Attic) calendar and Olympiad reckoning (`src/lib/greek.ts`)

An explicit **reconstruction**. Real Athenian practice decreed
intercalation year to year rather than following a fixed rule (Wikipedia's
"Attic calendar" article: a 19-year Metonic cycle was developed in Athens
around 432 BCE but there is "no sign that any such system was in fact used
in Athens"), so this module picks one defensible, consistent convention
rather than guessing at attested-but-irregular history:

- The year begins at the first new moon at or after the summer solstice.
- 12 lunar months (Hekatombaion...Skirophorion) ordinarily; a year needing
  a 13th lunation always intercalates a second Poseideon immediately after
  the first (the single most commonly attested intercalation point,
  though real records show months 1, 2, 7, and 8 were repeated too on
  occasion).
- **Olympiad**: 776 BCE (Julian) = Ol. 1.1, incrementing every 4 years from
  the same year-start; this is the traditional epoch, not independently
  re-derived.
- Month names verified against Wikipedia's "Attic calendar" article,
  including the polytonic Greek forms (e.g. Ἑκατομβαιών).
- New moons and the solstice are root-found the same way as everywhere
  else in this project (Meeus 1998 formulas); day boundaries use a fixed
  mean-time offset for Athens's longitude, not the real sunset-to-sunset
  civil day Greek practice used (the same simplification `chinese.ts`
  makes for China Standard Time).

## Babylonian (Seleucid Era) calendar (`src/lib/babylonian.ts`)

An explicit **reconstruction**, epoch 1 Nisannu SE 1 = 3 April 311 BCE
(Julian) - Seleucus I's Babylonian-reckoning return to Babylon. Nisannu 1
is the first new moon at/after the vernal equinox each year; a year
needing a 13th lunar month intercalates Addaru II at year-end.

Richard A. Parker & Waldo H. Dubberstein's *Babylonian Chronology 626
B.C.-A.D. 75* documents that regularized Babylonian practice (attested
from 503 BCE) used a 19-year cycle in which 7 of every 19 years were
intercalary: 6 added Addaru II, and 1 (cycle position 17) added an Ululu
II mid-year instead. This module determines **whether** a year is
intercalary astronomically (does the gap between successive Nisannu-1
dates exceed 12 synodic months?), and always intercalates Addaru II when
it does. It does **not** attempt the Ululu-II exception: doing so would
require knowing which historical year corresponds to "cycle position 1,"
and an earlier version of this module that assumed the Seleucid Era's own
year 1 was cycle position 1 produced a leap-year pattern its own
astronomy contradicted at some dates - rather than guess at the correct
phase, the exception is simply not modeled. Month names are the standard
Akkadian transliterations (Nisannu, Ayyaru, ...); cuneiform logograms are
not rendered (same reasoning as Egyptian hieroglyphs, above).

## Astronomy (`src/lib/astronomy/`)

- **Sun** (`sunLongitude`): Meeus (1998) ch. 25 low-precision method.
  Measured against Skyfield + JPL DE421 over 1900-2053: max error 0.006
  degrees.
- **Moon** (`moonLongitude`, `moonPhase`): Meeus ch. 47 mean elements, the
  ten largest periodic terms of Table 47.A. Measured: max error 0.68
  degrees over 1900-2053. New moon times are found by root-finding on this
  formula (bisection on the Sun-Moon elongation), not read from Meeus's
  separate (and more accurate) ch. 49 periodic-term table for lunar phases.
- **Sunrise/sunset** (`sunTimes`): the standard low-precision hour-angle
  method (equivalent to the NOAA Solar Calculator). No Delta-T correction;
  treats the civil day as a constant 86400 SI seconds throughout history.
- **Planets** (`src/lib/astronomy/planets.ts`): E.M. Standish (JPL/Caltech),
  "Keplerian Elements for Approximate Positions of the Major Planets",
  Table 1 (the "1800 AD - 2050 AD" low-order fit), a pure two-body
  propagation with no perturbation corrections. **Only valid 1800-2050**;
  outside that range the underlying orbital propagation still runs, but
  accuracy is unverified and it should be read as illustrative motion, not
  a positional claim. Measured against Skyfield + DE421 within its valid
  range: max error 1.3-1.5 degrees per planet (consistent with a two-body
  model omitting mutual gravitational perturbations).
- **Back-dial cycles**: Metonic (235 synodic months ~= 19 tropical years),
  Callippic (4 Metonic cycles minus 1 day = 76 years), Saros (223 synodic
  months, ~6585.32 days), Exeligmos (3 Saros cycles). These are period
  lengths used to compute phase-within-cycle from an arbitrary epoch, not
  independently re-derived eclipse predictions.
- **Zodiac sign**: the tropical zodiac (0 degrees ecliptic longitude =
  Aries), a 30-degree-per-sign division with no reference to the actual
  constellation boundaries.

## What's not implemented

The project brief also described Aztec/Mexica tonalpohualli and
xiuhpohualli, and Hindu (Kali Yuga ahargana, tithi, nakshatra) calendars.

- **Aztec/Mexica**: the brief's own instructions say to include this only
  if the correlation constant (Caso's, tying the tonalpohualli/
  xiuhpohualli count to a JD) can be verified, and to cut it and say why
  otherwise. This project did not have a way to verify a specific
  correlation constant with confidence in the time available, so it was
  cut rather than guessed at.
- **Hindu**: explicitly a stretch goal in the brief. Cut for time; a
  correct implementation (Kali Yuga ahargana is straightforward, but tithi
  and nakshatra need sidereal positions with a specific ayanamsa, i.e.
  more astronomy than this project's Sun/Moon module currently offers)
  would need more time than remained.
