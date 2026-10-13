// Compare the library with ICU's independent Ethiopic and Amete Alem calendars.
// Usage: node studies/ethiopian-era/replay.mjs ./dist/lib > result.json
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const library = resolve(process.argv[2] ?? 'dist/lib');
const { ethiopianFromJD, ethiopianToJD, describeEthiopian, copticFromJD } = await import(
  pathToFileURL(resolve(library, 'coptic.js')).href
);
const { gregorianToJD } = await import(pathToFileURL(resolve(library, 'core/jd.js')).href);
const formatters = Object.fromEntries(
  ['ethiopic', 'ethioaa'].map((calendar) => [
    calendar,
    new Intl.DateTimeFormat('en-US', {
      calendar,
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      era: 'short',
    }),
  ]),
);
for (const [calendar, formatter] of Object.entries(formatters)) {
  assert.equal(
    formatter.resolvedOptions().calendar,
    calendar,
    'ICU must support the requested calendar',
  );
}
const inputs = [
  '-005000-01-01',
  '-000001-12-31',
  '0000-01-01',
  '0008-08-26',
  '0008-08-27',
  '0008-08-28',
  '0284-08-29',
  '1900-02-28',
  '1900-03-01',
  '2000-02-29',
  '2022-09-10',
  '2022-09-11',
  '2023-09-10',
  '2023-09-11',
  '2023-09-12',
  '2024-02-29',
  '2024-09-10',
  '2024-09-11',
  '2025-09-11',
  '2026-09-10',
  '2026-09-11',
  '2026-10-12',
  '2027-09-11',
  '2027-09-12',
  '2100-03-01',
  '5000-12-31',
];
const cases = inputs.map((input) => {
  const instant = new Date(`${input}T00:00:00Z`);
  assert.ok(Number.isFinite(instant.getTime()));
  const jd = gregorianToJD(
    instant.getUTCFullYear(),
    instant.getUTCMonth() + 1,
    instant.getUTCDate(),
  );
  const actual = ethiopianFromJD(jd);
  const references = Object.fromEntries(
    Object.entries(formatters).map(([calendar, formatter]) => {
      const parts = Object.fromEntries(
        formatter.formatToParts(instant).map((p) => [p.type, p.value]),
      );
      return [
        calendar,
        {
          year: Number(parts.year),
          month: Number(parts.month),
          day: Number(parts.day),
          era: parts.era,
        },
      ];
    }),
  );
  const { ethioaa, ethiopic } = references;
  assert.deepEqual(actual, { year: ethioaa.year - 5500, month: ethioaa.month, day: ethioaa.day });
  // Localized era labels vary by CLDR version (AM/AA versus ERA1/ERA0).
  assert.deepEqual(
    { year: ethiopic.year, month: ethiopic.month, day: ethiopic.day },
    { ...actual, year: actual.year >= 1 ? actual.year : actual.year + 5500 },
  );
  assert.equal(ethiopianToJD(actual), jd);
  const coptic = copticFromJD(jd);
  assert.deepEqual(coptic, { ...actual, year: actual.year - 276 });
  return { input, jd, actual, references, coptic };
});
console.log(
  JSON.stringify(
    {
      node: process.version,
      icu: process.versions.icu,
      cldr: process.versions.cldr,
      dates: cases.length,
      mismatches: 0,
      note: 'ICU uses Amete Alem before Amete Mihret year 1. Horologium explicitly continues its Incarnation-era arithmetic proleptically; subtract 5500 from Amete Alem for this comparison. This checks date conversion, not historical usage or religious observance.',
      cases,
      examples: ['0008-08-26', '2026-10-12'].map((input) => {
        const { jd } = cases.find((c) => c.input === input);
        return { input, tablet: describeEthiopian(jd) };
      }),
    },
    null,
    2,
  ),
);
