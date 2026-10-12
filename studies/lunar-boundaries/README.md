# Lunar searches and reconstructed year boundaries

This study compares source baseline `43fd938bb2e1bbd9ed8965da44984e631505d2be`
with the corrected library. It tests consistency with the existing model,
not astronomical accuracy or historically observed Greek/Babylonian dates.
The source changes are unreleased; no npm package or hosted site is updated.

## Reproduced failures

| Input or interval | Baseline | Corrected |
| --- | --- | --- |
| Five minutes before the January 2026 modeled new moon | `nextNewMoon` skips to the following lunation | Returns the imminent crossing |
| Five minutes after that crossing | Moon age 29.7641 days | Moon age five minutes |
| JD 2461147.376601852, Babylonian year-start civil day | 30 Addaru II, SE 2336 | 1 Nisannu, SE 2337 |
| JD 2461224.396031973, after solstice but before Hekatombaion | Attic year starts 2025; Ol. 701.2 | Attic year starts 2025; Ol. 701.1 |
| JD -105060.12340972222, near the earliest clock year | 1 Nisannu, SE -4688 | 1 Nisannu, SE -4689 |

The lunar search previously moved its input by `0.01` day (14.4 minutes).
That excluded actual nearby events from the search. It now brackets a real
negative-to-nonnegative elongation crossing and bisects to adjacent floating
point instants. A returned event can be passed back to `nextNewMoon`, which
is inclusive. `previousNewMoon` is strictly before its argument. `moonPhase`
uses an inclusive preceding crossing, giving age zero at the event.

Babylonian year selection previously compared event instants, while month
and day selection compared civil days. Year, month and day now use the same
modeled mean midnight at 44.4275 degrees east. Its equinox search previously
assumed May 1 Julian was after that year's event. This fails in some of the
earliest clock years. A July anchor keeps the event in the requested
year throughout the clock range, checked by the exhaustive year sweep below.

Greek Olympiad numbering previously took the year of the most recent
solstice, even when the Attic year had not yet begun. Both labels now use
the same selected year, with their boundary at modeled mean midnight at
23.7275 degrees east. Their expanded explanations state this simplification.

## Independent interval calculation

`verify.mjs` uses the baseline's **unchanged longitude formulas**, scans a
fixed daily grid for crossings, then bisects them. It does not call either
implementation's lunar search or calendar year-selection functions for the
expected results. Sorted event intervals determine the expected years,
months and days. Numerical comparisons allow one millisecond of root-location
rounding; that is a computational tolerance, not astronomical accuracy.

| Comparison | Cases | Baseline disagreements | Corrected disagreements |
| --- | ---: | ---: | ---: |
| New-moon searches and age at -20 min, -5 min, -1 s, +1 s, +5 min, +20 min | 5,964 | 3,976 | 0 |
| Babylonian dates around month/day/year boundaries | 5,035 | 276 | 0 |
| Attic dates and Olympiad labels around boundaries | 5,015 | 158 | 0 |
| Babylonian year at September 1 Julian, every year -5000 through 5000 | 10,001 | 165 | 0 |

The boundary grid covers 80 selected years across -5000 through 5000,
including a five-year modern grid from 1900 through 2050. A separate sweep
reuses one returned new moon in every year -5000 through 5000: inclusive next
search, strict previous search and zero age all agree at 10,001 crossings.
Eight hundred complete descriptions from the other ten calendar tablets
remain identical. The verifier also requires byte-identical function text
for the Sun longitude, Moon longitude and elongation models.

After building both source trees:

```sh
node studies/lunar-boundaries/verify.mjs /path/to/baseline /path/to/candidate results.json
```

For an installed package, pass its package directory as the candidate root.
The study's inputs are generated deterministically. Its receipt retains the
input hash, full-output hashes, disagreement counts and representative failures.

## Browser replay

`browser.mjs` serves the actual production assets with `Cache-Control:
no-store`, waits for the initial clock and fonts, then makes the browser
offline and stops the HTTP server **before** navigating to the counterexamples.
It checks Chromium and Firefox at 1440 and 375 pixels, visible calendar
labels, keyboard disclosures and retained focus, accessibility, CSP and
horizontal overflow. Screenshots show the actual calendar cards, including
their reconstruction labels. An additional post-conjunction date is an
unchanged control.

This replay also reproduced deferred font requests in both engines, including
a duplicate variable-font face request in Firefox. The corrected startup loads
all 26 bundled font faces (632,660 bytes), and 49 declarations are consolidated
to one per file, retaining each file's style and supported weight range.
`fc-scan` confirms that every merged file is variable. Font file bytes are
unchanged. This deliberately increases initial font loading so later scripts,
weights and transliteration characters remain available after going offline.
The replay checks all faces are loaded before disconnecting, then requires no
HTTP requests during subsequent navigation. See the CSS Font Loading
[load method](https://drafts.csswg.org/css-font-loading/#font-face-load) and
[readiness semantics](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready).

```sh
node studies/lunar-boundaries/browser.mjs /path/to/dist/app browser.json verify /path/to/screenshots
```

Use `baseline` instead of `verify` for the old labels. Neither replay measures
network availability of the hosted site or validates a physical clock.

## Limits

These fixes preserve the existing low-precision longitude formulas, simplified
intercalation and mean-midnight day conventions. They do not implement visible
crescent observation, historical sunset boundaries, actual Athenian decisions
or Babylonian Ululu II. A consistent reconstructed date can still differ from
an attested date. The Chinese calendar uses a separate conjunction series;
its numerical model is unchanged.
