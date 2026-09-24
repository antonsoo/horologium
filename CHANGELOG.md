# Changelog

All notable changes to this project are documented in this file.

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
