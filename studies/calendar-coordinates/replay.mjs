import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
assert.ok(args.includes('--library') && args.includes('--out') && args.includes('--label'));
const libraryURL = pathToFileURL(resolve(option('--library')));
const { core, egyptian, maya } = await import(libraryURL.href);
const referenceBytes = await readFile(new URL('./reference.json', import.meta.url));
const reference = JSON.parse(referenceBytes);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rows = [];
function seasonCoordinates(summary) {
  const head = summary.split(' — ')[0];
  const forward = /^(I|II|III|IV) (Akhet|Peret|Shemu), day (\d+) of the season$/.exec(head);
  const backward = /^(Akhet|Peret|Shemu) (I|II|III|IV), day (\d+) of the season$/.exec(head);
  return forward
    ? { ordinal: forward[1], season: forward[2], day: Number(forward[3]) }
    : backward
      ? { ordinal: backward[2], season: backward[1], day: Number(backward[3]) }
      : null;
}
const record = (id, kind, expected, actual, controls = {}) => {
  rows.push({
    id,
    kind,
    expected,
    actual,
    controls,
    agrees: JSON.stringify(expected) === JSON.stringify(actual),
  });
};

// Enumerate an ordinary wandering year. Advance a season-day counter through
// the published month table, rather than reusing describe()'s division/modulo.
let elapsed = 0;
let seasonDay = 0;
for (const [monthIndex, [ordinal, season]] of reference.egyptianMonths.entries()) {
  if (ordinal === 'I') seasonDay = 0;
  for (let day = 1; day <= 30; day++) {
    seasonDay++;
    const jd = 1448637.5 + elapsed++;
    const date = egyptian.fromJD(jd);
    const tablet = egyptian.describe(jd);
    assert.deepEqual(date, { year: 1, month: monthIndex + 1, day });
    record(
      `egyptian-${monthIndex + 1}-${day}`,
      'egyptian-season',
      { ordinal, season, day: seasonDay },
      seasonCoordinates(tablet.summary),
      {
        jd,
        date,
        native: tablet.native,
        summary: tablet.summary,
        sothic: egyptian.sothicCyclePosition(jd),
      },
    );
  }
}
for (let day = 1; day <= 5; day++) {
  const jd = 1448637.5 + elapsed++;
  assert.deepEqual(egyptian.fromJD(jd), { year: 1, month: 13, day });
  record(
    `epagomenal-${day}`,
    'epagomenal-control',
    'the 5 epagomenal days, outside all three seasons',
    egyptian.describe(jd).summary.split(' — ')[0],
  );
}
assert.equal(elapsed, 365);

for (const [year, month, day, expected] of [
  [0, 3, 13, 'III Akhet, day 73 of the season'],
  [-1, 8, 30, 'IV Peret, day 120 of the season'],
  [2773, 3, 13, 'III Akhet, day 73 of the season'],
  [2773, 8, 13, 'IV Peret, day 103 of the season'],
  [2773, 12, 13, 'IV Shemu, day 103 of the season'],
]) {
  const jd = 1448637.5 + (year - 1) * 365 + (month - 1) * 30 + day - 1;
  const tablet = egyptian.describe(jd);
  assert.deepEqual(egyptian.fromJD(jd), { year, month, day });
  assert.equal(Boolean(tablet.proleptic), year < 1);
  record(
    `egyptian-year-${year}-${month}-${day}`,
    'egyptian-year-control',
    seasonCoordinates(expected),
    seasonCoordinates(tablet.summary),
    { jd, native: tablet.native, summary: tablet.summary, proleptic: tablet.proleptic ?? null },
  );
}

for (const entry of reference.mayaDates) {
  const [baktun, katun, tun, winal, kin] = entry.longCount;
  const jd = core.gregorianToJD(...entry.date);
  const date = maya.fromJD(jd);
  assert.deepEqual(date.longCount, { baktun, katun, tun, winal, kin });
  assert.equal(maya.jdFromLongCount(date.longCount), jd);
  record(
    `maya-${entry.date.join('-')}`,
    'published-maya',
    { direct: entry.lord, combined: entry.lord, summary: entry.lord },
    {
      direct: maya.lordOfNightFromJD(jd),
      combined: date.lordOfNight,
      summary: /Lord of the Night (G[1-9])/.exec(maya.describe(jd).summary)?.[1] ?? null,
    },
    { jd, longCount: date.longCount, tzolkin: date.tzolkin, haab: date.haab, page: entry.page },
  );
}

// Constructed arithmetic controls, not additional observed inscriptions.
const cycle = ['G9', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
const offsets = [...Array.from({ length: 27 }, (_, i) => i - 9), 360, 7200, 144000, 1872000];
for (const correlation of [584283, 584285]) {
  let index = 0;
  for (const offset of offsets) {
    const lord = offset >= 360 ? 'G9' : cycle[index++ % cycle.length];
    const jd = correlation - 0.5 + offset;
    record(
      `maya-${correlation}-day-${offset}`,
      'constructed-maya',
      { direct: lord, combined: lord },
      {
        direct: maya.lordOfNightFromJD(jd, correlation),
        combined: maya.fromJD(jd, correlation).lordOfNight,
      },
    );
  }
}

const kinds = {};
for (const row of rows) {
  kinds[row.kind] ??= { cases: 0, disagreements: 0 };
  const counts = kinds[row.kind];
  counts.cases++;
  if (!row.agrees) counts.disagreements++;
}
const runtime = {};
for (const name of ['egyptian.js', 'maya.js', 'core/jd.js'])
  runtime[name] = sha256(await readFile(new URL(name, libraryURL)));
const result = {
  label: option('--label'),
  node: process.version,
  referenceSha256: sha256(referenceBytes),
  runtime,
  cases: rows.length,
  disagreements: rows.filter((row) => !row.agrees).length,
  kinds,
  rows,
};
await writeFile(option('--out'), `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    label: result.label,
    cases: result.cases,
    disagreements: result.disagreements,
    kinds,
  }),
);
if (!args.includes('--observe-only')) assert.equal(result.disagreements, 0);
