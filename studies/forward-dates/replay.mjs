// node replay.mjs --library LIBRARY_INDEX --out RECEIPT.json [--observe-only]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2),
  option = (key) => args[args.indexOf(key) + 1];
assert(args.includes('--library') && args.includes('--out'));
const library = resolve(option('--library')),
  output = resolve(option('--out'));
const observeOnly = args.includes('--observe-only');
const api = await import(pathToFileURL(library).href),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const fixtureBytes = await readFile(new URL('./months.json', import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const encode = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, v) =>
      typeof v === 'number' && !Number.isFinite(v) ? { number: String(v) } : v,
    ),
  );
const factories = {
  gregorian: (y, m, d) => api.core.gregorianToJD(y, m, d),
  julian: (y, m, d) => api.core.julianToJD(y, m, d),
  hebrew: (y, m, d) => api.hebrew.toJD({ year: y, month: m, day: d }),
  islamic: (y, m, d) => api.islamic.toJD({ year: y, month: m, day: d }),
  coptic: (y, m, d) => api.coptic.copticToJD({ year: y, month: m, day: d }),
  ethiopian: (y, m, d) => api.coptic.ethiopianToJD({ year: y, month: m, day: d }),
  egyptian: (y, m, d) => api.egyptian.toJD({ year: y, month: m, day: d }),
  zoroastrian: (y, m, d) => api.zoroastrian.toJD({ year: y, month: m, day: d }),
  // Retain the real wrapper record's redundant display fields; the documented
  // underlying Julian year/month/day determines its forward conversion.
  roman: (y, m, d) => api.roman.toJD({ ...api.roman.fromJD(2451544.5), year: y, month: m, day: d }),
  byzantine: (y, m, d) =>
    api.byzantine.toJD({
      ...api.byzantine.fromJD(2451544.5),
      julianYear: y,
      julianMonth: m,
      julianDay: d,
    }),
};
const inverse = {
  gregorian: api.core.jdToGregorian,
  julian: api.core.jdToJulian,
  hebrew: api.hebrew.fromJD,
  islamic: api.islamic.fromJD,
  coptic: api.coptic.copticFromJD,
  ethiopian: api.coptic.ethiopianFromJD,
  egyptian: api.egyptian.fromJD,
  zoroastrian: api.zoroastrian.fromJD,
  roman: api.roman.fromJD,
  byzantine: api.byzantine.fromJD,
};
const valid = [],
  invalid = [];
for (const [name, y, m, days, start] of fixture.months) {
  const names = name === 'julian' ? [name, 'roman', 'byzantine'] : [name];
  for (const calendar of names) {
    for (const day of [1, 1.25, days, days + 0.75])
      valid.push({
        calendar,
        input: [y, m, day],
        expected: start + day - 1,
        reference: 'convertdate',
      });
    for (const day of [1.000001, 1.1, days + 0.999999])
      valid.push({ calendar, input: [y, m, day], reference: 'baseline compatibility' });
    invalid.push({ calendar, reason: 'past-month-end', input: [y, m, days + 1] });
  }
}
// Compatibility controls for the project's fixed 365-day models. They are
// compared between phases; they are not an independent historical oracle.
for (const calendar of ['egyptian', 'zoroastrian'])
  for (const year of [-3000, -1, 0, 1, 1395, 2773, 5000])
    for (let month = 1; month <= 13; month++) {
      const days = month === 13 ? 5 : 30;
      for (const day of [1, 1.25, days, days + 0.75])
        valid.push({ calendar, input: [year, month, day], reference: 'baseline compatibility' });
      for (const day of [1.000001, 1.1, days + 0.999999])
        valid.push({ calendar, input: [year, month, day], reference: 'baseline compatibility' });
      invalid.push({ calendar, reason: 'past-month-end', input: [year, month, days + 1] });
    }
for (const calendar of Object.keys(factories)) {
  const year = calendar === 'hebrew' ? 5784 : 2025;
  const months = ['coptic', 'ethiopian', 'egyptian', 'zoroastrian', 'hebrew'].includes(calendar)
    ? 13
    : 12;
  for (const [reason, input] of [
    ['year-NaN', [NaN, 1, 1]],
    ['year-infinity', [Infinity, 1, 1]],
    ['year-fraction', [year + 0.5, 1, 1]],
    ['year-string', [String(year), 1, 1]],
    ['year-boolean', [true, 1, 1]],
    ['year-unsafe', [2 ** 53, 1, 1]],
    ['year-unrepresentable-date', [Number.MAX_SAFE_INTEGER, 1, 1]],
    ['month-zero', [year, 0, 1]],
    ['month-negative', [year, -1, 1]],
    ['month-fraction', [year, 1.5, 1]],
    ['month-infinity', [year, Infinity, 1]],
    ['month-NaN', [year, NaN, 1]],
    ['month-string', [year, '1', 1]],
    ['month-boolean', [year, true, 1]],
    ['past-last-month', [year, months + 1, 1]],
    ['day-zero', [year, 1, 0]],
    ['day-negative', [year, 1, -1]],
    ['day-infinity', [year, 1, Infinity]],
    ['day-NaN', [year, 1, NaN]],
    ['day-string', [year, 1, '1']],
    ['day-boolean', [year, 1, true]],
  ])
    invalid.push({ calendar, reason, input });
}
invalid.push({ calendar: 'hebrew', reason: 'Adar-II-in-common-year', input: [5785, 13, 1] });
const validResults = [];
for (const test of valid) {
  try {
    const jd = factories[test.calendar](...test.input);
    validResults.push({
      ...test,
      jd,
      matches: test.expected === undefined || jd === test.expected,
    });
  } catch (error) {
    validResults.push({ ...test, error: String(error), matches: false });
  }
}
const invalidResults = [];
for (const test of invalid) {
  let row = { ...test };
  try {
    const jd = factories[test.calendar](...test.input);
    row = { ...row, jd, refused: false };
    try {
      row.interpretation = inverse[test.calendar](jd);
    } catch (error) {
      row.interpretationError = String(error);
    }
  } catch (error) {
    row = { ...row, refused: error instanceof RangeError, error: String(error) };
  }
  const control =
    validResults.find((v) => v.calendar === test.calendar && v.expected !== undefined) ??
    validResults.find((v) => v.calendar === test.calendar);
  try {
    row.recovers = factories[test.calendar](...control.input) === control.jd;
  } catch {
    row.recovers = false;
  }
  invalidResults.push(row);
}
// Native ICU independently checks the Ethiopian epoch and month coordinates.
const fmt = new Intl.DateTimeFormat('en-US-u-ca-ethiopic', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});
assert.equal(fmt.resolvedOptions().calendar, 'ethiopic');
const icu = [];
for (let year = 1900; year <= 2100; year += 5)
  for (let month = 1; month <= 12; month++)
    for (const day of [1, 15]) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
      const input = [Number(parts.year), Number(parts.month), Number(parts.day)];
      const expected = date.getTime() / 86400000 + 2440587.5;
      try {
        const jd = factories.ethiopian(...input);
        icu.push({ gregorian: [year, month, day], input, expected, jd, matches: jd === expected });
      } catch (error) {
        icu.push({
          gregorian: [year, month, day],
          input,
          expected,
          error: String(error),
          matches: false,
        });
      }
    }
const modules = {};
async function hashModules(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await hashModules(path);
    else if (entry.name.endsWith('.js'))
      modules[relative(dirname(library), path)] = sha(await readFile(path));
  }
}
await hashModules(dirname(library));
const validOutputs = validResults.map(({ calendar, input, jd, error }) => ({
  calendar,
  input,
  jd,
  ...(error ? { error } : {}),
}));
const receipt = {
  node: process.version,
  icuVersion: process.versions.icu,
  observeOnly,
  driverSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  fixtureSha256: sha(fixtureBytes),
  modules,
  validCases: validResults.length,
  validMatches: validResults.filter((t) => t.matches).length,
  oracleCases: validResults.filter((t) => t.expected !== undefined).length,
  validOutputsSha256: sha(JSON.stringify(validOutputs)),
  validDisagreements: validResults.filter((t) => !t.matches),
  invalidCases: invalidResults.length,
  refused: invalidResults.filter((t) => t.refused).length,
  recoveries: invalidResults.filter((t) => t.recovers).length,
  icuCases: icu.length,
  icuMatches: icu.filter((t) => t.matches).length,
  icuDisagreements: icu.filter((t) => !t.matches),
  invalid: invalidResults,
  scope:
    'Forward calendar input domains and unchanged valid JD arithmetic; separate convertdate and native ICU checks do not establish historical attestation or ephemeris accuracy.',
};
const { invalid: outcomes, ...summary } = encode(receipt);
await writeFile(
  output,
  `${JSON.stringify(summary, null, 2).slice(0, -2)},
  "invalid": [
${outcomes.map((row) => `    ${JSON.stringify(row)}`).join(',\n')}
  ]
}
`,
);
console.log(
  JSON.stringify({
    node: receipt.node,
    validCases: receipt.validCases,
    validMatches: receipt.validMatches,
    oracleCases: receipt.oracleCases,
    validOutputsSha256: receipt.validOutputsSha256,
    invalidCases: receipt.invalidCases,
    refused: receipt.refused,
    recoveries: receipt.recoveries,
    icuCases: receipt.icuCases,
    icuMatches: receipt.icuMatches,
  }),
);
if (!observeOnly) {
  assert.equal(
    receipt.validCases,
    receipt.validMatches,
    JSON.stringify(receipt.validDisagreements),
  );
  assert.equal(receipt.invalidCases, receipt.refused);
  assert.equal(receipt.invalidCases, receipt.recoveries);
  assert.equal(receipt.icuCases, receipt.icuMatches, JSON.stringify(receipt.icuDisagreements));
}
