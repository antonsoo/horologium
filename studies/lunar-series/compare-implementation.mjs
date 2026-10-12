// A transcription check, distinct from the independent JPL ephemeris oracle.
// node compare-implementation.mjs ASTRONOMIA_CHECKOUT CANDIDATE_ROOT RECEIPT
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [reference, candidate, output] = process.argv.slice(2).map((path) => resolve(path));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: reference,
  encoding: 'utf8',
}).trim();
assert.equal(commit, '71e16c942b143a1a5a067b6aab2d8532064704ae');
assert.equal(
  execFileSync('git', ['status', '--porcelain'], { cwd: reference, encoding: 'utf8' }),
  '',
);
const { position } = await import(pathToFileURL(resolve(reference, 'src/moonposition.js')));
const { moonLongitude } = await import(
  pathToFileURL(resolve(candidate, 'dist/lib/astronomy/sun-moon.js'))
);
const fixture = JSON.parse(await readFile(new URL('./oracle.json', import.meta.url)));
const ancient = [];
for (let year = -5000; year <= 5000; year += 25) {
  const date = new Date(0);
  date.setUTCFullYear(year, 6, 1);
  ancient.push(date.getTime() / 86400000 + 2440587.5);
}
const records = [...fixture.jd, ...ancient].map((jd) => ({
  jd,
  actual: moonLongitude(jd),
  reference: ((position(jd).lon * 180) / Math.PI + 360) % 360,
}));
const maxDifference = Math.max(
  ...records.map((row) => Math.abs(((row.actual - row.reference + 540) % 360) - 180)),
);
assert.ok(maxDifference < 1e-6);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = [];
for (const path of ['src/moonposition.js', 'src/base.js', 'LICENSE']) {
  const bytes = await readFile(resolve(reference, path));
  files.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
const receipt = {
  node: process.version,
  repository: 'https://github.com/commenthol/astronomia',
  commit,
  files,
  cases: records.length,
  ancientComputationalProbes: ancient.length,
  maxDifferenceDegrees: maxDifference,
  outputSha256: sha(JSON.stringify(records)),
  scope:
    'Transcription parity only. Ancient dates are not validated against an ephemeris or physical observations.',
};
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
