// Compare actual installed package entry points with the fresh UTC oracle.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [registryRoot, sourceRoot, oraclePath, output] = process.argv.slice(2);
assert(
  registryRoot && sourceRoot && oraclePath && output,
  'consumer.mjs REGISTRY_PACKAGE SOURCE_PACKAGE ORACLE_JSON OUTPUT_JSON',
);
const load = (root) => import(pathToFileURL(resolve(root, 'dist/lib/index.js')).href);
const before = await load(registryRoot),
  after = await load(sourceRoot);
const oracle = JSON.parse(await readFile(oraclePath, 'utf8'));
const events = oracle.events.map((e) => {
  const old = before.astronomy.nextNewMoon(e.jdUTC - 1),
    current = after.astronomy.nextNewMoon(e.jdUTC - 1);
  const record = {
    ...e,
    registryEventJd: old,
    sourceEventJd: current,
    registryUTCErrorMinutes: (old - e.jdUTC) * 1440,
    sourceUTCErrorMinutes: (current - e.jdUTC) * 1440,
    registryDay: e.id.startsWith('babylonian')
      ? before.babylonian.fromJD(e.clockJD).day
      : before.greek.atticFromJD(e.clockJD).day,
    sourceDay: e.id.startsWith('babylonian')
      ? after.babylonian.fromJD(e.clockJD).day
      : after.greek.atticFromJD(e.clockJD).day,
  };
  assert.equal(record.sourceDay, e.expectedDayInModeledMonth);
  assert(Math.abs(record.sourceUTCErrorMinutes) < 3);
  return record;
});
const jd = after.core.gregorianToJD(2012, 12, 21);
const registry = {
  version: JSON.parse(await readFile(resolve(registryRoot, 'package.json'))).version,
  summary: before.maya.describe(jd).summary,
  nightLabel: before.maya.lordOfNightFromJD(jd),
  inspector: typeof before.chinese.inspectChineseYear,
  invalidForwardDate: before.core.gregorianToJD(2025, 2, 29),
};
let invalidError;
try {
  after.core.gregorianToJD(2025, 2, 29);
} catch (e) {
  invalidError = { name: e.name, message: e.message };
}
assert.equal(invalidError.name, 'RangeError');
assert.equal(after.maya.lordOfNightFromJD(jd), 'G9');
const source = {
  commit: '48adbe3a063a13c16474515370bbbcfc79b8b3f1',
  summary: after.maya.describe(jd).summary,
  nightLabel: after.maya.lordOfNightFromJD(jd),
  inspector: typeof after.chinese.inspectChineseYear,
  invalidForwardDate: invalidError,
};
const invariant = [];
for (const [name, api] of [
  ['registry', before],
  ['source', after],
]) {
  const lc = api.maya.fromJD(jd).longCount;
  invariant.push({
    name,
    longCount: `${lc.baktun}.${lc.katun}.${lc.tun}.${lc.winal}.${lc.kin}`,
    hebrew: api.hebrew.describe(jd).native,
  });
}
assert.equal(invariant[0].longCount, '13.0.0.0.0');
assert.equal(invariant[0].longCount, invariant[1].longCount);
assert.equal(invariant[0].hebrew, invariant[1].hebrew);
const receipt = { node: process.version, registry, source, events, stableReadmeExample: invariant };
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
