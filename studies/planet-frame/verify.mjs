// node verify.mjs BASELINE_ROOT CANDIDATE_OR_INSTALLED_ROOT RECEIPT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [baseline, candidate, output] = process.argv.slice(2).map((path) => resolve(path));
const load = (root, path) => import(pathToFileURL(resolve(root, `dist/lib/${path}.js`)));
const before = await load(baseline, 'astronomy/planets');
const after = await load(candidate, 'astronomy/planets');
const { eclipticOfDate } = await load(candidate, 'astronomy/precession');
const bytes = await readFile(new URL('./oracle.json', import.meta.url));
const fixture = JSON.parse(bytes);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const stats = (values, reference) => {
  const errors = values.map((value, i) => diff(value, reference[i]));
  return {
    maxDegrees: Math.max(...errors),
    rmsDegrees: Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length),
    differingSectors: values.filter(
      (value, i) => Math.floor(value / 30) !== Math.floor(reference[i] / 30),
    ).length,
  };
};
const planets = [];
const examples = [];
for (const [p, planet] of after.PLANETS.entries()) {
  const old = fixture.jd.map((jd) => before.planetLongitude(before.PLANETS[p], jd));
  const current = fixture.jd.map((jd) => after.planetLongitude(planet, jd));
  const ref = fixture.positions[p];
  assert.equal(planet.name.toLowerCase(), ref.name);
  assert.ok(current.every((value) => Number.isFinite(value) && value >= 0 && value < 360));
  const oldMean = stats(old, ref.meanOfDate),
    newMean = stats(current, ref.meanOfDate);
  assert.ok(newMean.maxDegrees < oldMean.maxDegrees / 5);
  assert.ok(newMean.maxDegrees < 0.24);
  assert.ok(
    diff(
      after.planetLongitude(planet, 2451545),
      before.planetLongitude(before.PLANETS[p], 2451545),
    ) < 1e-12,
  );
  const exampleIndex = fixture.dates.findIndex(
    (date, i) =>
      date.startsWith('2026') &&
      Math.floor(old[i] / 30) !== Math.floor(ref.meanOfDate[i] / 30) &&
      Math.floor(current[i] / 30) === Math.floor(ref.meanOfDate[i] / 30),
  );
  if (exampleIndex >= 0)
    examples.push({
      name: planet.name,
      date: fixture.dates[exampleIndex],
      jd: fixture.jd[exampleIndex],
      before: old[exampleIndex],
      after: current[exampleIndex],
      reference: ref.meanOfDate[exampleIndex],
    });
  planets.push({
    name: planet.name,
    before: {
      meanOfDate: oldMean,
      apparentOfDate: stats(old, ref.apparentOfDate),
      j2000: stats(old, ref.j2000),
    },
    after: { meanOfDate: newMean, apparentOfDate: stats(current, ref.apparentOfDate) },
    beforeSha256: sha(JSON.stringify(old)),
    afterSha256: sha(JSON.stringify(current)),
  });
}
let maxComponentError = 0;
for (const row of fixture.transforms) {
  const vector = eclipticOfDate(row.input, (row.jd - 2451545) / 36525);
  row.expected.forEach((value, i) => {
    maxComponentError = Math.max(maxComponentError, Math.abs(value - vector[i]));
  });
}
assert.ok(maxComponentError < 1e-10);
const unchanged = [];
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await files(resolve(directory, entry.name), `${path}/`)));
    else result.push(path);
  }
  return result.sort();
}
for (const path of await files(resolve(baseline, 'dist/lib'))) {
  if (!path.endsWith('.js') || path === 'astronomy/planets.js') continue;
  const a = await readFile(resolve(baseline, 'dist/lib', path));
  const b = await readFile(resolve(candidate, 'dist/lib', path));
  assert.deepEqual(b, a, `${path} changed outside the planetary frame correction`);
  unchanged.push({ path, bytes: a.length, sha256: sha(a) });
}
const receipt = {
  node: process.version,
  dates: fixture.jd.length,
  positions: fixture.jd.length * 5,
  fixtureSha256: sha(bytes),
  planets,
  examples,
  transforms: { vectors: fixture.transforms.length, maxComponentError },
  unchangedLibraryModules: unchanged,
  kernel: fixture.kernel,
  versions: fixture.versions,
};
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      dates: receipt.dates,
      positions: receipt.positions,
      transforms: receipt.transforms,
      beforeSectorDifferences: planets.reduce(
        (n, p) => n + p.before.meanOfDate.differingSectors,
        0,
      ),
      afterSectorDifferences: planets.reduce((n, p) => n + p.after.meanOfDate.differingSectors, 0),
      examples,
    },
    null,
    2,
  ),
);
