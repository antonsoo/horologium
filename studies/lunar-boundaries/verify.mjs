/** Independent interval oracle for the existing reconstruction, not an ephemeris.
 * node verify.mjs BASELINE_ROOT CANDIDATE_ROOT OUTPUT_JSON
 * Both roots must have their library built in dist/lib.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [baselineRoot, candidateRoot, output] = process.argv.slice(2);
if (!output) throw new Error('Usage: verify.mjs BASELINE_ROOT CANDIDATE_ROOT OUTPUT_JSON');
const load = (root) => import(pathToFileURL(resolve(root, 'dist/lib/index.js')).href);
const baseline = await load(baselineRoot);
const candidate = await load(candidateRoot);
const hash = (value) => createHash('sha256').update(value).digest('hex');
for (const name of ['sunLongitude', 'moonLongitude', 'moonElongation']) {
  assert.equal(candidate.astronomy[name].toString(), baseline.astronomy[name].toString());
}
const phase = (jd) => {
  const angle = baseline.astronomy.moonLongitude(jd) - baseline.astronomy.sunLongitude(jd);
  return ((angle + 540) % 360) - 180;
};
const solar = (target) => (jd) =>
  ((baseline.astronomy.sunLongitude(jd) - target + 540) % 360) - 180;
// Scan a fixed one-day grid, independent of both implementations' directed
// 1.23-day search and calendar year-selection loops. Then bisect each crossing.
function events(start, end, f) {
  const found = [];
  for (let left = start; left < end; left += 1) {
    let lo = left;
    let hi = left + 1;
    if (!(f(lo) < 0 && f(hi) >= 0 && f(hi) - f(lo) < 180)) continue;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (mid === lo || mid === hi) break;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    found.push(hi);
  }
  return found;
}
const years = [
  ...new Set([
    ...Array.from({ length: 41 }, (_, i) => -5000 + i * 250),
    ...Array.from({ length: 31 }, (_, i) => 1900 + i * 5),
    -776,
    -775,
    -774,
    -311,
    -310,
    -1,
    1,
    2025,
    2026,
    4999,
  ]),
].sort((a, b) => a - b);
const instantCases = [];
const calendarCases = [];
const localDay = (jd, longitude) => Math.floor(jd + longitude / 360 + 0.5);
for (const year of years) {
  const start = baseline.core.julianToJD(year - 1, 1, 1);
  const end = baseline.core.julianToJD(year + 2, 1, 1);
  const moons = events(start, end, phase);
  const equinoxes = events(start, end, solar(0));
  const solstices = events(start, end, solar(90));
  for (let index = 1; index < moons.length - 1; index++) {
    const moon = moons[index];
    if (
      moon < baseline.core.julianToJD(year, 1, 1) ||
      moon >= baseline.core.julianToJD(year + 1, 1, 1)
    )
      continue;
    for (const seconds of [-1200, -300, -1, 1, 300, 1200]) {
      const jd = moon + seconds / 86400;
      const previous = seconds < 0 ? moons[index - 1] : moon;
      const next = seconds < 0 ? moon : moons[index + 1];
      instantCases.push({
        year,
        jd,
        seconds,
        expected: { previous, next, ageDays: jd - previous },
      });
    }
  }
  for (const [calendar, seasons, longitude] of [
    ['babylonian', equinoxes, 44.4275],
    ['greek', solstices, 23.7275],
  ]) {
    const starts = seasons.map((season) => moons.find((moon) => moon >= season));
    assert.equal(starts.length, 3);
    assert.ok(starts.every(Number.isFinite));
    const boundaries = moons.filter((moon) => moon >= starts[1] && moon < starts[2]);
    const lastPrevious = moons.filter((moon) => moon < starts[1]).at(-1);
    const sampleJDs = [
      // The solstice/equinox to first-month gap reveals inconsistent year labels.
      (seasons[1] + starts[1]) / 2,
      ...boundaries.flatMap((moon) => {
        const midnight = localDay(moon, longitude) - 0.5 - longitude / 360;
        return [
          midnight - 1 / 86400,
          midnight + 1 / 86400,
          midnight + 0.5,
          moon - 1 / 86400,
          moon + 1 / 86400,
        ];
      }),
    ];
    assert.ok(lastPrevious);
    for (const jd of sampleJDs) {
      const dayNumber = localDay(jd, longitude);
      const indexYear = starts.findLastIndex((moon) => localDay(moon, longitude) <= dayNumber);
      if (indexYear < 0) throw new Error('Missing earlier year in independent event grid');
      const yearMoons = moons.filter(
        (moon) => moon >= starts[indexYear] && moon < starts[indexYear + 1],
      );
      const monthIndex = yearMoons.findLastIndex((moon) => localDay(moon, longitude) <= dayNumber);
      assert.ok(monthIndex >= 0);
      const yearNumber = year - 1 + indexYear;
      const day = dayNumber - localDay(yearMoons[monthIndex], longitude) + 1;
      assert.ok(day >= 1 && day <= 30);
      let expected;
      if (calendar === 'babylonian') {
        expected = {
          seYear: yearNumber + 311,
          month: Math.min(monthIndex + 1, 12),
          isIntercalary: monthIndex === 12,
          day,
        };
      } else {
        const intercalated = yearMoons.length === 13;
        const yearsSince = yearNumber + 775;
        expected = {
          attic: {
            yearStartsIn: yearNumber,
            month: monthIndex + 1 - (intercalated && monthIndex > 5 ? 1 : 0),
            isIntercalary: intercalated && monthIndex === 6,
            day,
          },
          olympiad: {
            number: Math.floor(yearsSince / 4) + 1,
            year: (((yearsSince % 4) + 4) % 4) + 1,
          },
        };
      }
      calendarCases.push({ calendar, year, jd, expected });
    }
  }
}
const execute = (library) => {
  const failures = [];
  const digests = createHash('sha256');
  const counts = { lunar: 0, babylonian: 0, greek: 0 };
  for (const item of instantCases) {
    const actual = {
      previous: library.astronomy.previousNewMoon(item.jd),
      next: library.astronomy.nextNewMoon(item.jd),
      ageDays: library.astronomy.moonPhase(item.jd).ageDays,
    };
    digests.update(JSON.stringify(actual));
    if (
      Object.keys(actual).some((key) => Math.abs(actual[key] - item.expected[key]) * 86400 > 0.001)
    ) {
      counts.lunar++;
      if (failures.length < 12) failures.push({ ...item, actual });
    }
  }
  for (const item of calendarCases) {
    const actual =
      item.calendar === 'babylonian'
        ? library.babylonian.fromJD(item.jd)
        : {
            attic: library.greek.atticFromJD(item.jd),
            olympiad: library.greek.olympiadFromJD(item.jd),
          };
    digests.update(JSON.stringify(actual));
    if (JSON.stringify(actual) !== JSON.stringify(item.expected)) {
      counts[item.calendar]++;
      if (failures.filter((value) => value.calendar === item.calendar).length < 6)
        failures.push({ ...item, actual });
    }
  }
  return { failures: counts, examples: failures, outputSha256: digests.digest('hex') };
};
const before = execute(baseline);
const after = execute(candidate);
const yearSweep = { years: 10001, beforeWrongYears: 0, afterWrongYears: 0, reusableCrossings: 0 };
for (let year = -5000; year <= 5000; year++) {
  const jd = baseline.core.julianToJD(year, 9, 1);
  if (baseline.babylonian.fromJD(jd).seYear !== year + 311) yearSweep.beforeWrongYears++;
  if (candidate.babylonian.fromJD(jd).seYear !== year + 311) yearSweep.afterWrongYears++;
  const event = candidate.astronomy.nextNewMoon(jd);
  assert.equal(candidate.astronomy.nextNewMoon(event), event);
  assert.equal(candidate.astronomy.moonPhase(event).ageDays, 0);
  assert.ok(event - candidate.astronomy.previousNewMoon(event) > 29);
  yearSweep.reusableCrossings++;
}
const unchanged = [
  ['roman', 'describe'],
  ['egyptian', 'describe'],
  ['hebrew', 'describe'],
  ['islamic', 'describe'],
  ['maya', 'describe'],
  ['chinese', 'describe'],
  ['coptic', 'describeCoptic'],
  ['coptic', 'describeEthiopian'],
  ['byzantine', 'describe'],
  ['zoroastrian', 'describe'],
];
const controlDigest = createHash('sha256');
for (const year of years) {
  const jd = baseline.core.gregorianToJD(year, 7, 1);
  for (const [calendar, method] of unchanged) {
    const old = baseline[calendar][method](jd);
    assert.deepEqual(candidate[calendar][method](jd), old);
    controlDigest.update(JSON.stringify({ year, calendar, method, result: old }));
  }
}
const result = {
  schemaVersion: 1,
  scope:
    'Independent daily-grid crossing and civil-interval oracle for the unchanged low-precision reconstruction. Not ephemeris accuracy or historical attestation.',
  years,
  cases: {
    lunar: instantCases.length,
    babylonian: calendarCases.filter((v) => v.calendar === 'babylonian').length,
    greek: calendarCases.filter((v) => v.calendar === 'greek').length,
  },
  inputSha256: hash(JSON.stringify({ instantCases, calendarCases })),
  modelFunctionsUnchanged: ['sunLongitude', 'moonLongitude', 'moonElongation'],
  verifierSha256: hash(await readFile(new URL(import.meta.url))),
  before,
  after,
  yearSweep,
  unchangedCalendars: {
    methods: unchanged,
    cases: years.length * unchanged.length,
    outputSha256: controlDigest.digest('hex'),
  },
};
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({ cases: result.cases, before: before.failures, after: after.failures }),
);
assert.deepEqual(after.failures, { lunar: 0, babylonian: 0, greek: 0 });
assert.equal(yearSweep.afterWrongYears, 0);
