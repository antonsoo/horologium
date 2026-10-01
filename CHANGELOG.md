# Changelog

All notable changes to this project are documented in this file.

## [0.2.2] - 2026-10-01

### Fixed

- Weekdays before JD 0 (1 January 4713 BCE). `jdWeekday` took its remainder
  with `%`, which is negative there, so it returned values like -5 that are no
  weekday. The Hebrew postponement rules compare against the weekday of the
  molad, so 192 of the 6,000 years before the era came out 356 or 382 days
  long, and on the last day of each the date repeated the day before. The
  Hebrew tablet also named six days in seven "Yom Rishon" back there, and
  `roman.latinWeekday` threw. Dates from JD 0 on were never affected.

### Added

- `tests/properties.test.ts`: on 6,000 seeded days from 8,800 years before
  the present era to 11,700 years after it, every calendar converts a day to
  a date and back to the same day, holds that date for the whole day and no
  longer, and renders its tablet without a NaN.

## [0.2.1] - 2026-10-01

### Added

- The package is named `@antonsoloviev/horologium`, ready for npm. It isn't
  published yet; until it is, install from GitHub.

### Fixed

- Installing from GitHub (`npm install github:antonsoo/horologium`, which the
  README recommended) gave a package with no built code, so the import
  failed: there was no `prepare` script to build it. There is one now.

## [0.2.0] - 2026-09-30

### Added

- `CalendarTablet.proleptic`: set when a date falls before the calendar's own
  starting point (an era's year 1, or the Julian reform for the Roman
  calendar), with a note saying where the count starts. The app shows a
  "proleptic" badge and the note on those tablets; before, "3 Safar -1670 AH"
  or "SE -688" appeared with nothing to say no one wrote such a year.

### Fixed

- The Hebrew tablet's native line ended in an empty year for dates before
  AM 1 (3761 BCE), since Hebrew-letter numerals have no zero or negatives; it
  now stops after the month.
- The README's opening example gave the Roman date for 24 September 2026 as
  "a.d. VIII Kal. Oct.", reckoned on the Gregorian date. The library, like a
  Roman, reckons on the Julian date: "a.d. III Id. Sept."
- The Roman tablet's method text and `docs/CALENDARS.md` now say that dates
  from 45 BCE to about 8 CE follow the every-fourth-year leap rule, while the
  pontifices actually intercalated every third year until Augustus corrected
  it, so the civil date in Rome can differ by a day or two.

## [0.1.0] - 2026-09-24

Initial release.

### Added

- Julian Day / Modified JD core, proleptic Gregorian and Julian calendars.
- Roman (Julian) civil calendar: Kalends/Nones/Ides in Latin, AUC year,
  Roman numerals, Latin planetary weekday, and seasonal hours (horae,
  vigiliae) from real sunrise/sunset at a chosen location.
- Byzantine Anno Mundi calendar and the 15-year Indiction cycle.
- Islamic tabular (civil) calendar.
- Coptic and Ethiopian calendars.
- Hebrew calendar with exact molad/dehiyyot arithmetic and Hebrew-letter
  numerals.
- Egyptian civil (wandering) calendar, Era of Nabonassar, and Sothic-cycle
  position.
- Maya Long Count, Tzolk'in, Haab', and Lord of the Night, with SVG
  bar-and-dot numerals.
- Chinese calendar: sexagenary year/day, and an astronomically-computed
  lunisolar month/day (new moons and the 24 solar terms in China Standard
  Time) with the standard leap-month rule.
- Zoroastrian (Yazdegerdi) calendar.
- Greek Olympiad reckoning and an astronomical reconstruction of the Attic
  lunisolar calendar, with polytonic Greek month names.
- Babylonian (Seleucid Era) calendar, an astronomical reconstruction with
  the standard 19-year intercalation cycle.
- Sun/Moon low-precision astronomy (position, phase, zodiac sign), the
  Metonic/Callippic/Saros/Exeligmos cycles, and Standish Keplerian-element
  positions for the five naked-eye planets.
- A web app: a bronze, Antikythera-inspired front dial (zodiac ring,
  Egyptian calendar ring, Sun/Moon/planet/date pointers), a back dial with
  the Metonic and Saros spirals, calendar tablets in native script, live
  ticking, BCE-capable time travel, a location picker (including
  geolocation), four historical presets, and a URL permalink.
- Oracle-verified test fixtures (`convertdate`, `lunardate`, and Skyfield +
  JPL DE421) cross-checking Hebrew, Islamic, Coptic, Mayan, Chinese, and
  astronomical calculations against independent implementations.

### Known limitations

See the "Accuracy and limitations" section of the README and
`docs/CALENDARS.md`.
