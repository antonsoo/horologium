import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { chinese, core } = await import(pathToFileURL(process.argv[3]));
const start = performance.now();
const signature = (d) => [d.yearNumber, d.month, d.isLeapMonth, d.day, d.dayGanzhi.index];
const same = (a, b) => a.every((value, i) => value === b[i]);
const localDate = (jd) =>
  core
    .jdToDate(jd + 1 / 3)
    .toISOString()
    .slice(0, 10);
const references = new Map(input.days.map((d) => [d[0], d.slice(1, 6)]));
// These are three documented historical Beijing-time month starts. The
// comparison retains all 90 differences; this narrow classification does not
// turn them into matching dates or excuse new discrepancies elsewhere.
const historicalShifts = [
  ['1914-11-17', '1914-12-17'],
  ['1916-02-03', '1916-03-04'],
  ['1920-11-10', '1920-12-10'],
];
function knownHistoricalDifference(civil, expected, actual, jd) {
  const shift = historicalShifts.find(([start, end]) => civil >= start && civil < end);
  if (!shift) return false;
  const adjusted = [...expected];
  if (civil === shift[0]) {
    const previous = references.get(localDate(jd - 1));
    adjusted.splice(0, 4, previous[0], previous[1], previous[2], previous[3] + 1);
  } else adjusted[3]--;
  return same(adjusted, actual);
}
const mismatches = [];
const dayBoundaryMismatches = [];
const counters = { year: 0, month: 0, leap: 0, day: 0, ganzhi: 0 };
let calendarMismatchedDays = 0;
let modernCheckedDays = 0;
let modernMismatchedDays = 0;
let modernCalendarMismatchedDays = 0;
let unexpectedMismatchedDays = 0;
let inconsistentCivilDays = 0;
let inconsistentCalendarCivilDays = 0;
for (const [civil, year, month, leap, day, ganzhi, file, line] of input.days) {
  const [y, m, d] = civil.split('-').map(Number);
  const midnight = core.gregorianToJD(y, m, d) - 1 / 3;
  const jd = midnight + 0.5;
  const actual = signature(chinese.chineseFromJD(jd));
  const expected = [year, month, leap, day, ganzhi];
  const fields = expected.map((value, i) => value !== actual[i]);
  for (const [i, key] of Object.keys(counters).entries()) if (fields[i]) counters[key]++;
  if (fields.slice(0, 4).some(Boolean)) calendarMismatchedDays++;
  const isModern = civil >= '1929-01-01';
  if (isModern) modernCheckedDays++;
  if (isModern && fields.slice(0, 4).some(Boolean)) modernCalendarMismatchedDays++;
  if (fields.some(Boolean)) {
    const explainedByHistoricalClock = knownHistoricalDifference(civil, expected, actual, jd);
    if (!explainedByHistoricalClock) unexpectedMismatchedDays++;
    if (isModern) modernMismatchedDays++;
    mismatches.push({
      civil,
      source: `${file}:${line}`,
      expected,
      actual,
      explainedByHistoricalClock,
    });
  }
  // Every date part must agree at midnight, noon and the final second.
  let changed = false;
  let calendarChanged = false;
  for (const offset of [0, 1 - 1 / 86400]) {
    const boundary = signature(chinese.chineseFromJD(midnight + offset));
    if (!same(actual, boundary)) {
      changed = true;
      dayBoundaryMismatches.push({ civil, offset, noon: actual, actual: boundary });
    }
    if (!same(actual.slice(0, 4), boundary.slice(0, 4))) calendarChanged = true;
  }
  if (changed) inconsistentCivilDays++;
  if (calendarChanged) inconsistentCalendarCivilDays++;
}

const inspection = {
  available: typeof chinese.inspectChineseYear === 'function',
  years: 0,
  months: 0,
  monthStartDifferences: [],
  solarTermDateDifferences: [],
  uncheckedSolarTerms: [],
  inconsistentBoundaries: [],
};
if (inspection.available) {
  const solarNames = [
    'Vernal Equinox',
    'Corn Rain',
    'Corn Forms',
    'Summer Solstice',
    'Great Heat',
    'End of Heat',
    'Autumnal Equinox',
    'Frost',
    'Light Snow',
    'Winter Solstice',
    'Severe Cold',
    'Spring Showers',
  ];
  const termDates = new Map(
    input.days
      .filter((d) => solarNames.includes(d[8]))
      .map((d) => [`${d[0].slice(0, 4)}:${solarNames.indexOf(d[8]) * 30}`, d[0]]),
  );
  for (let year = 1901; year < 2100; year++) {
    const view = chinese.inspectChineseYear(year);
    inspection.years++;
    const expected = input.boundaries.filter((b) => b[1] === year);
    if (expected.length !== view.months.length)
      inspection.inconsistentBoundaries.push({ year, reason: 'month count' });
    for (const [i, month] of view.months.entries()) {
      inspection.months++;
      const ref = expected[i];
      const civil = localDate(month.startJD);
      if (!ref || civil !== ref[0] || month.month !== ref[2] || month.isLeapMonth !== ref[3]) {
        inspection.monthStartDifferences.push({
          year,
          expected: ref,
          actual: [civil, year, month.month, month.isLeapMonth],
        });
      }
      if (
        localDate(month.newMoonJD) !== civil ||
        month.days !== month.endJD - month.startJD ||
        (i && month.startJD !== view.months[i - 1].endJD) ||
        (i === 0 && month.startJD !== view.startJD) ||
        (i === view.months.length - 1 && month.endJD !== view.endJD)
      ) {
        inspection.inconsistentBoundaries.push({
          year,
          month: month.month,
          reason: 'event/day boundary',
        });
      }
      for (const term of month.principalTerms) {
        const actual = localDate(term.jd);
        const expected = termDates.get(`${actual.slice(0, 4)}:${term.longitudeDeg}`);
        if (!expected) inspection.uncheckedSolarTerms.push({ year, term, actual });
        else if (actual !== expected)
          inspection.solarTermDateDifferences.push({
            year,
            term: term.name,
            actual,
            expected,
            flaggedNearMidnight: month.nearMidnight.some(
              (flag) => flag.kind === 'principal-term' && flag.jd === term.jd,
            ),
          });
      }
    }
  }
}
console.log(
  JSON.stringify({
    sourceFiles: 200,
    sourceRows: input.sourceRows,
    sourceGaps: input.sourceGaps,
    unlabelledLeadingDays: input.sourceRows - input.days.length,
    checkedDays: input.days.length,
    start: input.days[0][0],
    end: input.days.at(-1)[0],
    dailyInstants: input.days.length * 3,
    checkedMonthStarts: input.boundaries.length,
    mismatchedDays: mismatches.length,
    calendarMismatchedDays,
    modernCheckedDays,
    modernMismatchedDays,
    modernCalendarMismatchedDays,
    unexpectedMismatchedDays,
    inconsistentCivilDays,
    inconsistentCalendarCivilDays,
    byField: counters,
    dayBoundaryMismatches,
    inspection,
    mismatches,
    elapsedMs: Math.round(performance.now() - start),
  }),
);
