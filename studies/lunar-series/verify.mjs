// node verify.mjs BASELINE_ROOT CANDIDATE_OR_INSTALLED_ROOT RECEIPT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { uncachedCalendars } from './uncached-calendars.mjs';

const [baseline, candidate, output] = process.argv.slice(2).map((path) => resolve(path));
const library = (root) => import(pathToFileURL(resolve(root, 'dist/lib/index.js')));
const before = await library(baseline),
  after = await library(candidate);
const bytes = await readFile(new URL('./oracle.json', import.meta.url));
const fixture = JSON.parse(bytes);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const stats = (errors) => ({
  max: Math.max(...errors.map(Math.abs)),
  rms: Math.sqrt(errors.reduce((sum, x) => sum + x * x, 0) / errors.length),
});
const results = {};
for (const [name, lib] of Object.entries({ before, after })) {
  const positions = fixture.jd.map((jd) => lib.astronomy.moonLongitude(jd));
  const events = fixture.newMoonsTT.map((jd) => lib.astronomy.nextNewMoon(jd - 1));
  const clocks = fixture.clock2026.map((row) => lib.astronomy.moonLongitude(row.jdUTC));
  results[name] = {
    meanLongitudeDegrees: stats(positions.map((value, i) => diff(value, fixture.meanLongitude[i]))),
    apparentLongitudeDegrees: stats(
      positions.map((value, i) => diff(value, fixture.apparentLongitude[i])),
    ),
    conjunctionMinutes: stats(events.map((value, i) => (value - fixture.newMoonsTT[i]) * 1440)),
    clock2026Degrees: stats(
      clocks.map((value, i) => diff(value, fixture.clock2026[i].apparentLongitude)),
    ),
    modernUTCConjunctionMinutes: stats(
      fixture.modernConjunctionsUTC.map(
        (row) => (lib.astronomy.nextNewMoon(row.jdUTC - 1) - row.jdUTC) * 1440,
      ),
    ),
    positionsSha256: sha(JSON.stringify(positions)),
    conjunctionsSha256: sha(JSON.stringify(events)),
    nominalConjunctionDayDifferences: Object.fromEntries(
      [
        ['babylonian', 44.4275],
        ['greek', 23.7275],
      ].map(([calendar, lon]) => [
        calendar,
        events.filter(
          (value, i) =>
            Math.floor(value + lon / 360 + 0.5) !==
            Math.floor(fixture.newMoonsTT[i] + lon / 360 + 0.5),
        ).length,
      ]),
    ),
  };
}
assert.ok(results.after.meanLongitudeDegrees.max < 0.005);
assert.ok(results.after.apparentLongitudeDegrees.max < 0.01);
assert.ok(results.after.conjunctionMinutes.max < 2);
assert.ok(results.after.clock2026Degrees.max < 0.02);
assert.ok(results.after.modernUTCConjunctionMinutes.max < 3);

// Independent uncached calendar execution: reuse the baseline's original
// calendar code, rebinding its imports to the corrected candidate's arithmetic.
// This tests cache correctness/eviction without duplicating the new cache logic.
const uncached = await uncachedCalendars(baseline, candidate);
const referenceModules = uncached.referenceModules;
const cacheDates = new Set();
// Jump among eras (more than eight years), revisit them, then cross each side
// of modern month boundaries. Traversing in both orders exercises eviction.
for (const year of [
  -5000, -3000, -2000, -775, -311, -1, 0, 1, 1600, 1900, 2000, 2026, 2050, 3000, 4999, 5000,
]) {
  for (const month of [1, 3, 6, 7, 9, 12])
    cacheDates.add(after.core.gregorianToJD(year, month, 1) + 0.5);
}
for (const event of fixture.newMoonsTT.filter((jd) => after.core.jdToGregorian(jd).year === 2026)) {
  const modeled = after.astronomy.nextNewMoon(event - 1);
  for (const lon of [44.4275, 23.7275]) {
    const midnight = Math.floor(modeled + lon / 360 + 0.5) - 0.5 - lon / 360;
    for (const offset of [-1, 1, 43200]) cacheDates.add(midnight + offset / 86400);
  }
}
const dates = [...cacheDates],
  cacheDigest = createHash('sha256');
let cacheComparisons = 0;
for (const jd of [...dates, ...dates.toReversed(), ...dates]) {
  for (const [name, method] of [
    ['babylonian', 'fromJD'],
    ['greek', 'atticFromJD'],
    ['greek', 'olympiadFromJD'],
  ]) {
    const expected = uncached[name][method](jd),
      actual = after[name][method](jd);
    assert.deepEqual(actual, expected, `${name}.${method} at ${jd}`);
    // Mutating a returned date cannot alter private cached year structures.
    cacheDigest.update(JSON.stringify({ name, method, jd, actual }));
    for (const key of Object.keys(actual)) actual[key] = -999;
    assert.deepEqual(after[name][method](jd), expected);
    cacheComparisons++;
  }
}
const controls = [
  'chinese',
  'hebrew',
  'islamic',
  'roman',
  'egyptian',
  'coptic',
  'ethiopian',
  'maya',
  'byzantine',
  'zoroastrian',
];
const controlDigest = createHash('sha256');
for (const jd of dates)
  for (const name of controls) {
    const method =
      name === 'coptic'
        ? 'describeCoptic'
        : name === 'ethiopian'
          ? 'describeEthiopian'
          : 'describe';
    const actual = after[name][method](jd);
    assert.deepEqual(actual, before[name][method](jd), `${name} changed`);
    controlDigest.update(JSON.stringify({ name, jd, actual }));
  }
const boundaryCases = [
  {
    id: 'babylonian-2020',
    calendar: 'babylonian',
    jd: 2458873.876590278,
    before: '2 Shabatu, SE 2330',
    after: '1 Shabatu, SE 2330',
  },
  {
    id: 'greek-2022',
    calendar: 'greek',
    jd: 2459848.9340902776,
    before: '1 Pyanepsion, Ol. 700.2 (year begins 2022 CE)',
    after: '2 Pyanepsion, Ol. 700.2 (year begins 2022 CE)',
  },
];
for (const row of boundaryCases) {
  assert.equal(before[row.calendar].describe(row.jd).summary, row.before);
  assert.equal(after[row.calendar].describe(row.jd).summary, row.after);
}
const civilEvidence = boundaryCases.map((row) => {
  const lon = row.calendar === 'babylonian' ? 44.4275 : 23.7275;
  const reference = fixture.modernConjunctionsUTC.find(
    (event) => Math.abs(event.jdUTC - row.jd) < 1,
  );
  assert.ok(reference);
  const expectedStartDay = Math.floor(reference.jdUTC + lon / 360 + 0.5);
  const actualStartDay = Math.floor(
    after.astronomy.nextNewMoon(reference.jdUTC - 1) + lon / 360 + 0.5,
  );
  const day = Math.floor(row.jd + lon / 360 + 0.5) - expectedStartDay + 1;
  const actual =
    row.calendar === 'babylonian'
      ? after.babylonian.fromJD(row.jd)
      : after.greek.atticFromJD(row.jd);
  assert.equal(actualStartDay, expectedStartDay);
  assert.equal(actual.day, day);
  return {
    id: row.id,
    referenceConjunction: reference,
    expectedStartDay,
    actualStartDay,
    expectedDay: day,
  };
});
const april = fixture.newMoonsTT.find((jd) => jd > 2461140 && jd < 2461150);
const beforeEvent = before.astronomy.nextNewMoon(april - 1),
  afterEvent = after.astronomy.nextNewMoon(april - 1);
const midpoint = (beforeEvent + afterEvent) / 2;
const ageCase = {
  jd: midpoint,
  referenceNewMoonTT: april,
  beforeEvent,
  afterEvent,
  beforeAgeDays: before.astronomy.moonPhase(midpoint).ageDays,
  afterAgeDays: after.astronomy.moonPhase(midpoint).ageDays,
};
assert.ok(ageCase.beforeAgeDays < 0.1 && ageCase.afterAgeDays > 29);
const receipt = {
  node: process.version,
  fixtureSha256: sha(bytes),
  positions: fixture.jd.length,
  conjunctions: fixture.newMoonsTT.length,
  results,
  cache: {
    comparisons: cacheComparisons,
    returnedRecordsMutatedAndRechecked: cacheComparisons,
    outputSha256: cacheDigest.digest('hex'),
    referenceModules,
  },
  unchangedCalendarDescriptions: {
    cases: dates.length * controls.length,
    outputSha256: controlDigest.digest('hex'),
  },
  boundaryCases,
  civilEvidence,
  ageCase,
  kernel: fixture.kernel,
  versions: fixture.versions,
};
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      positions: receipt.positions,
      conjunctions: receipt.conjunctions,
      results,
      cache: receipt.cache.comparisons,
      unchanged: receipt.unchangedCalendarDescriptions.cases,
      ageCase,
    },
    null,
    2,
  ),
);
