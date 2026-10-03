# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

In the clock page; the library is unchanged.

### Fixed

- On a 320-pixel-wide screen (a phone, or a laptop window zoomed to 400%) the
  page scrolled sideways: the city list and "Use my location" stayed on one
  line, 28 pixels wider than the screen. The button now moves under the list
  when they do not fit. Every other site was checked the same way, empty and
  with a sample loaded.

## [0.2.3] - 2026-10-02

The library's code is unchanged; the fixes are in the clock page.

### Added

- The library is published to npm as `@antonsoloviev/horologium`:
  `npm install @antonsoloviev/horologium`. The README uses the registry package
  instead of the GitHub install, which npm 12 blocks by default.

### Fixed

- The theme button did nothing when clicked, at most window widths. It sits at
  the top right of the header, underneath the page's content wrapper, which
  is stacked above it and took the click (between about 480 and 1,400 pixels
  wide all or most of the button was covered; the keyboard still worked).
  Found by asking, for every control on every site at five widths, whether a
  click at its centre would land on it.
- "Use my location" could say "Locating..." until the page was reloaded.
  Firefox calls neither geolocation callback when its permission prompt is
  closed without a choice. The page now waits 20 seconds for any answer, then
  gives the button back and says the browser has not answered; an answer that
  comes later is still used. Found by running the page in Firefox beside
  Chromium.
- Pressing the button twice left its label on "Locating..." (or on "Location
  unavailable") for good: the label to restore was read from the button, which
  by then said that. The button is disabled while a request is out.
- Every use of the button added another "My location" to the list of cities,
  and choosing "My location" from the list again, after another city, changed
  the list and not the clock. There is one entry, and it restores the
  position.
- A refusal, a failure to find a position and a browser without a location
  service each get a sentence under the list (announced to screen readers);
  the last of these used to do nothing at all.

### Changed

- The page's fonts are served by the page itself. They came from Google Fonts,
  the one request the page made to another origin; the same font files (every
  subset, as Google serves them to a current browser) are now in
  `src/app/fonts/`, with their SIL Open Font License texts. Nothing looks
  different: screenshots before and after match. The page now loads with
  every other host blocked.

### Security

- The built page carries a Content-Security-Policy. Scripts, styles, fonts and
  workers load from the page's own origin only, and `connect-src 'self'` has
  the browser refuse to send what you give the page to any other host, even
  for a script injected through a bug in how the page renders a file. Inline
  event handlers and `eval` are not allowed. Every control was exercised
  in Chromium and Firefox with a listener for policy violations: none.

### Accessibility

- Checked with axe-core (WCAG 2.1 A and AA, and its best-practice rules) in light and dark,
  at desktop and phone widths: no findings now. The primary button's
  label was 3.5:1 on its green in the light theme; it sits on the darker green
  of the links (6.7:1).

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

- The package is named `@antonsoloviev/horologium`, ready for npm (published
  there from 0.2.3).

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
