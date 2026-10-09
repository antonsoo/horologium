# Chinese calendar verification - 2026-10-08

The Chinese calendar correction and lunar-year inspector were checked locally
on WSL2 Linux with Node 24.21.0 / npm 11.19.0, from a separate checkout and
fresh dependency install. This work has not been published to npm or the
hosted clock. The registry package remains 0.2.3 and lacks these corrections.

## Calendar evidence

The [reproducible study](../studies/chinese-calendar/README.md) pins 200 HKO
daily tables and an independent JPL DE440s event calculation. The original
`43d6721` was rebuilt in a detached worktree; its discrepancy counts reproduced
the original measurement exactly. The revised installed package produced
the same daily report as the source build, including all retained differences.

| Observation | Original | Revised |
| --- | ---: | ---: |
| Different month/day/year in 62,821 available HKO dates, 1929-2100 | 1,315 | 0 |
| Different month/day/year in the full 73,029-date comparison | 1,628 | 90 |
| Wrong sexagenary day against the stated 2019 anchor | 73,029 | 0 |
| Calendar date changes within one UTC+8 day | 201 | 0 |

Each date was sampled at midnight, noon and the final second. The year
inspection was separately checked across 199 complete lunar years and
2,461 months. The 90 historical differences, ten approximate solar-term
date differences, missing source day and unlabelled leading days remain
explicit in the report. No lookup table was added to the runtime.

## Application and package checks

| Check | Result |
| --- | --- |
| Fresh `npm ci`, lint and typecheck | Passed |
| `npm test` | 217 tests in 19 files passed |
| `de_DE.UTF-8` locale | The same 217 tests passed |
| `npm run build` | Library in `dist/lib`; site in `dist/app`; JS 28.95 kB gzip |
| Production Chromium and Firefox workflows | 56 passed, including 24 inspector workflows |
| Offline workflow | Month navigation and JSON export work after disconnecting the browser |
| Download snapshot | Export equals the public API and retains the downloaded year after navigation |
| Download failure | A simulated object-URL failure leaves the ledger readable and retry succeeds |
| Live boundary | Lunar year/month/day change together at the 2027 New Year midnight; unfinished date entry survives |
| Keyboard and state | Month selection preserves focus, open event disclosures and the normal time permalink |
| Inspection layouts | 320/375/1280 px, light/dark, both browsers; no horizontal overflow or automated accessibility violations |
| Inspector console errors and external requests | Zero |
| Local quickstart | `npm install` and `npm run dev` render the 2033 example; attribution URL returns the full MIT text |
| Packed library | 38 files, installed into a separate consumer; JS examples work on Node 20.0.0 and 24.21.0 |
| Public types | `ChineseYear`, `ChineseMonth`, `ChineseDate` and `PrincipalTerm` compile under strict NodeNext resolution |
| Attribution | Included in the package and built site; served as plain text during development |
| Registry README examples | Maya, Hebrew, Roman and Egyptian output verified against a fresh npm 0.2.3 install |

The development attribution route was fixed after the full browser run.
Lint, typecheck and build passed again; the production JS, CSS and attribution
file remained byte-for-byte identical to the tested build.

Commands used for the clean application check:

```sh
npm ci
npm run lint
npm run typecheck
npm test
LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 npm test
npm run build
npm run test:browser
node examples/basic-usage.mjs
node examples/chinese-year.mjs 2033
node examples/chinese-year.mjs 2033 --json
```

For an installed-package comparison after building:

```sh
check_dir=$(mktemp -d)
mkdir -p "$check_dir/consumer"
npm pack --ignore-scripts --pack-destination "$check_dir"
npm --prefix "$check_dir/consumer" install "$check_dir/"*.tgz
python3 studies/chinese-calendar/fetch.py
python3 studies/chinese-calendar/verify.py \
  --module "$check_dir/consumer/node_modules/@antonsoloviev/horologium/dist/lib/index.js" \
  --output "$check_dir/daily-results.json"
node studies/chinese-calendar/verify-events.mjs "$check_dir/event-results.json"
```

The fetch/verifier were also exercised with a truncated table and a missing
table: both conditions fail verification. A fresh download of the missing
2033 table matched its pinned hash. The verifier rejects a library missing
the inspection API and limits the three historical month-start allowances
to the exact one-day shifts with unchanged year/month/leap labels.

## Visual review and limits

The [desktop ledger](assets/chinese-year-desktop.png),
[375-pixel dark ledger](assets/chinese-year-mobile.png), and
[unedited example output](assets/chinese-year-terminal.png) were opened and
reviewed. The ledger retains the clock's papyrus/bronze style; the repeated
month is highlighted and empty-term regular months explain their rule.
The full year requires vertical scrolling on a phone. Automated accessibility
checks supplement keyboard use and visual inspection; they do not establish
universal accessibility.

Chinese New Year now means civil midnight, a behavior change for consumers
that previously treated it as a conjunction instant. The API supplies the
conjunction separately. Historical Beijing time and earlier Chinese calendar
reforms remain outside scope. Solar terms and future near-midnight events
remain approximate; the review flag is not a certified error bound.

Build with `npm run build`; the deployment input is `dist/app`. These local
checks establish no new hosted or registry release.
