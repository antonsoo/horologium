// node replay.mjs BASELINE_ROOT CANDIDATE_ROOT OUTPUT_JSON
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [baseline, candidate, output] = process.argv.slice(2).map((p) => resolve(p));
const load = (root, file) => import(pathToFileURL(resolve(root, 'dist/lib', `${file}.js`)));
const before = await load(baseline, 'astronomy/planets');
const after = await load(candidate, 'astronomy/planets');
const { eclipticOfDate } = await load(candidate, 'astronomy/precession');
const { gregorianToJD } = await load(candidate, 'core/jd');
const bytes = await readFile(new URL('./oracle.json', import.meta.url));
const oracle = JSON.parse(bytes);
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const stats = (values) => ({
  count: values.length,
  maxDegrees: Math.max(...values),
  rmsDegrees: Math.sqrt(values.reduce((sum, x) => sum + x * x, 0) / values.length),
});
const records = [];
let maxTranscriptionError = 0;
for (const row of oracle.positions) {
  const old = before.planetLongitude(
    before.PLANETS.find((p) => p.name === row.name),
    row.jd,
  );
  const result = after.planetPositions(row.jd);
  const value = result.positions.find((p) => p.name === row.name).longitudeDeg;
  assert.ok(Number.isFinite(value) && value >= 0 && value < 360);
  const legacy = after.planetLongitude(
    after.PLANETS.find((p) => p.name === row.name),
    row.jd,
  );
  assert.equal(legacy, old, 'legacy Table 1 API changed');
  if (result.model.id === 'jpl-1800-2050') assert.equal(value, old, 'modern fit changed');
  else {
    const [x, y] = eclipticOfDate(row.table2VectorJ2000, (row.jd - 2451545) / 36525);
    const expected = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    maxTranscriptionError = Math.max(maxTranscriptionError, distance(value, expected));
    assert.ok(distance(value, expected) < 1e-8, 'independent coefficient calculation');
  }
  records.push({
    ...row,
    before: old,
    after: value,
    model: result.model,
    beforeErrorDeg: distance(old, row.longitudeDeg),
    afterErrorDeg: distance(value, row.longitudeDeg),
  });
}
const planets = after.PLANETS.map((p) => {
  const rows = records.filter(
    (r) => r.name === p.name && r.model.inRange && r.model.id !== 'jpl-1800-2050',
  );
  const old = stats(rows.map((r) => r.beforeErrorDeg));
  const current = stats(rows.map((r) => r.afterErrorDeg));
  assert.ok(current.maxDegrees < 0.4 && current.rmsDegrees < old.rmsDegrees / 3);
  return {
    name: p.name,
    before: old,
    after: current,
    withoutTable2b: stats(rows.map((r) => distance(r.withoutTable2bDeg, r.longitudeDeg))),
    beforeSectorDifferences: rows.filter(
      (r) => Math.floor(r.before / 30) !== Math.floor(r.longitudeDeg / 30),
    ).length,
    afterSectorDifferences: rows.filter(
      (r) => Math.floor(r.after / 30) !== Math.floor(r.longitudeDeg / 30),
    ).length,
  };
});
// Dense modern control retains the previous frame study's exact values.
const modern = JSON.parse(await readFile(new URL('../planet-frame/oracle.json', import.meta.url)));
const modernValues = [];
for (const jd of modern.jd) {
  const actual = after.planetPositions(jd);
  assert.equal(actual.model.id, 'jpl-1800-2050');
  const expected = before.PLANETS.map((p) => before.planetLongitude(p, jd));
  assert.deepEqual(
    actual.positions.map((p) => p.longitudeDeg),
    expected,
  );
  modernValues.push(...expected);
}
const switches = [1800, 2050].map((year) => {
  const jd = gregorianToJD(year, 1, 1);
  const a = after.planetPositions(jd - 1e-6),
    b = after.planetPositions(jd + 1e-6);
  return {
    year,
    jd,
    beforeModel: a.model.id,
    afterModel: b.model.id,
    longitudeJumpsDegrees: a.positions.map((p, i) => ({
      name: p.name,
      degrees: distance(p.longitudeDeg, b.positions[i].longitudeDeg),
    })),
  };
});
const endpoints = [-5000, -2999, 3000, 5000].map((year) => {
  const jd = gregorianToJD(year, 1, 1),
    result = after.planetPositions(jd);
  assert.equal(result.model.inRange, year === -2999 || year === 3000);
  for (const p of result.positions) assert.ok(Number.isFinite(p.longitudeDeg));
  return { year, jd, ...result };
});
await writeFile(
  output,
  `${JSON.stringify(
    {
      node: process.version,
      oracleSha256: sha(bytes),
      versions: oracle.versions,
      positions: records.length,
      modernUnchangedPositions: modernValues.length,
      modernValuesSha256: sha(JSON.stringify(modernValues)),
      independentCoefficientMaxDifferenceDegrees: maxTranscriptionError,
      planets,
      switches,
      endpoints,
      records,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify(
    {
      positions: records.length,
      modernUnchanged: modernValues.length,
      maxTranscriptionError,
      planets,
      switches,
    },
    null,
    2,
  ),
);
