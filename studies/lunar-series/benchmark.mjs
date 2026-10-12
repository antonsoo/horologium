// node benchmark.mjs BUILT_ROOT OUTPUT [BASELINE_WITH_UNCACHED_CALENDARS]

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { uncachedCalendars } from './uncached-calendars.mjs';

const root = resolve(process.argv[2]),
  output = resolve(process.argv[3]);
const library = await import(`${root}/dist/lib/index.js`);
const calendars = process.argv[4]
  ? await uncachedCalendars(resolve(process.argv[4]), root)
  : library;
const start = library.core.gregorianToJD(2026, 1, 1);
const grids = {
  liveSeconds: Array.from({ length: 120 }, (_, i) => start + i / 86400),
  dailySteps: Array.from({ length: 365 }, (_, i) => start + i),
  solsticeGap: Array.from({ length: 120 }, (_, i) => start + 175 + i / 86400),
};
const receipt = { node: process.version, cases: {} };
for (const [name, dates] of Object.entries(grids)) {
  const times = [],
    hashes = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    const out = [],
      begin = performance.now();
    for (const jd of dates)
      out.push([calendars.babylonian.fromJD(jd), calendars.greek.atticFromJD(jd)]);
    times.push(performance.now() - begin);
    hashes.push(createHash('sha256').update(JSON.stringify(out)).digest('hex'));
  }
  receipt.cases[name] = { calls: dates.length * 2, milliseconds: times, sha256: hashes };
}
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(receipt);
