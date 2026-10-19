# Solar-event correction: clean source and installed artifact

Implementation `7efec4e` replaces the UTC-noon declination snapshot with a
bracketed search through the changing solar model. It preserves sunrise and
sunset independently, withholds grazing boundaries and keeps the `sunTimes`
compatibility shape. The [independent study](../studies/solar-events/README.md)
retains original and corrected browser output plus the full JPL comparison.

The 2026 comparison covers 37,247 JPL crossings at 74 sites. The source
accepts 37,148 timestamps and explicitly withholds 99 reference crossings as
grazing. Accepted output has zero unmatched crossings and no errors above
five minutes; the largest paired error is 2.113 minutes. This is sampled
agreement with a numerical ephemeris, not observed sunrise accuracy.

A clean `git archive 7efec4e` was installed and built using Node 24.21.0 and
npm 11.19.0. No working node_modules or compiled library was copied in.

| Verification | Result |
| --- | --- |
| `npm ci` | 47 packages installed; zero reported audit vulnerabilities |
| Lint, strict type checks, build | Passed |
| Numerical suite | 285 tests in 27 files; passed in default and de_DE locales |
| Production browsers | 62 Chromium/Firefox workflows passed |
| Clean and working builds | All 30 static and 60 library files byte-identical across Node 24/26 |
| Packed consumer | 44-file, 81,961-byte tarball installed in a fresh dependency-free consumer |
| Installed artifact comparison | Complete 27,158-call replay matches source event counts, controls and every per-site result |

Commands from the clean archive:

```sh
npm ci
npm run lint
npm run typecheck
npm test
LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 npm test
npm run build
npm run test:browser
npm pack --ignore-scripts --pack-destination OUTPUT_DIR --json
```

A fresh consumer then installed that tarball with `npm install --ignore-scripts`.
`studies/solar-events/replay.mjs OUTPUT_DIR PATH_TO_INSTALLED_INDEX` loaded the
consumer package through its actual compiled library. It reproduced the
source result against the independent ephemeris, including every withheld
boundary. This establishes the packed source artifact; npm 0.2.3 is a separate,
older registry artifact.

The [verification receipt](../studies/solar-events/verification.json) records
source revision, tooling, checks and every build file's SHA-256. Dedicated
browser visits additionally exercise sixteen controls at 1440/375 pixels,
fully offline after startup, with synthetic geolocation. No page exceptions,
CSP violations, external requests or horizontal overflow occurred. Both
original/corrected desktop readouts and the phone workflow were inspected.

The clock retains its existing typography, dial and responsive layout. The
new copy distinguishes a missing event from a near-horizon uncertainty. The
nominal 0.02-degree band is an engineering guard; weather, terrain, elevation
and historical Delta-T remain unmodeled. No field observations were performed.

Build command: `npm run build`. Static site: `dist/app/`, base `/horologium/`.
Compiled library: `dist/lib/`. Source, site deployment, installed package and
registry releases remain separate claims; publication receipts follow in the
study when verified.

Suggested GitHub description: Ancient calendar clock with inspectable lunar
rules and explicit uncertainty in solar events.

Suggested topics: `calendar`, `astronomy`, `antikythera`, `typescript`,
`solar-events`, `chinese-calendar`, `julian-day`.

```text
7efec4e fix: preserve solar crossings and grazing uncertainty at polar transitions
```
