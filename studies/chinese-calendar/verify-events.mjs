import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  calendarNewMoon,
  calendarSolarCrossing,
  universalToTerrestrial,
} from '../../dist/lib/astronomy/calendar-events.js';

const data = JSON.parse(readFileSync(new URL('./events.json', import.meta.url), 'utf8'));
assert.equal(data.newMoons.length, 2487);
assert.equal(data.principalTerms.length, 2412);
const maxError = (events, calculate) => {
  let worst;
  for (const [key, tt] of events) {
    const seconds = Math.abs(universalToTerrestrial(calculate(key, tt)) - tt) * 86400;
    if (!worst || seconds > worst.seconds) worst = { key, referenceTT: tt, seconds };
  }
  return worst;
};
const newMoons = maxError(data.newMoons, (k) => calendarNewMoon(k));
const principalTerms = maxError(data.principalTerms, (deg, tt) =>
  calendarSolarCrossing(tt - 1, deg),
);
assert.ok(newMoons.seconds < 18);
assert.ok(principalTerms.seconds < 900);
const result = {
  ephemeris: { url: data.source, sha256: data.sha256, bytes: data.bytes },
  skyfield: data.skyfield,
  numpy: data.numpy,
  timeScale: 'TT',
  start: data.start,
  endExclusive: data.endExclusive,
  newMoons: { compared: data.newMoons.length, maximumError: newMoons },
  principalTerms: { compared: data.principalTerms.length, maximumError: principalTerms },
  note: 'This measures orbital/event models in TT. It does not validate Delta-T predictions or guarantee future UTC civil days.',
};
const output = process.argv[2]
  ? pathToFileURL(process.argv[2])
  : new URL('./event-results.json', import.meta.url);
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
