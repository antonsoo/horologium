import assert from 'node:assert/strict';
import { chinese, core, hebrew, maya, planets } from '@antonsoloviev/horologium';

const jd = core.julianToJD(-43, 3, 15);
const result = planets.planetPositions(jd);
assert.equal(result.model.id, 'jpl-3000bce-3000ce');
assert.equal(result.model.inRange, true);
assert.equal(result.positions.find((p) => p.name === 'Jupiter').longitudeDeg, 295.5940022409385);
assert.equal(planets.planetPositions(core.gregorianToJD(2026, 1, 1)).model.id, 'jpl-1800-2050');
assert.equal(planets.planetPositions(core.gregorianToJD(-5000, 1, 1)).model.inRange, false);
const day = core.gregorianToJD(2012, 12, 21),
  lc = maya.fromJD(day).longCount;
assert.equal(`${lc.baktun}.${lc.katun}.${lc.tun}.${lc.winal}.${lc.kin}`, '13.0.0.0.0');
assert.equal(hebrew.describe(day).native, 'ח׳ טבת תשע״ג');
assert.equal(chinese.inspectChineseYear(2033).months.find((m) => m.isLeapMonth)?.month, 11);
for (const input of [NaN, Infinity, 1e308])
  assert.throws(() => planets.planetPositions(input), RangeError);
console.log(
  JSON.stringify(
    {
      node: process.version,
      packageImport: '@antonsoloviev/horologium',
      jd,
      ...result,
      documentedCalendarExamples: true,
      invalidInputsRejected: true,
    },
    null,
    2,
  ),
);
