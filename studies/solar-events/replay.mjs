import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [output, library = path.join(root, 'dist/lib/index.js')] = process.argv.slice(2);
assert(output, 'Usage: node studies/solar-events/replay.mjs OUTPUT_DIR [LIBRARY_INDEX]');
const bytes = await readFile(new URL('./cache/events.json', import.meta.url));
const oracle = JSON.parse(bytes);
const fixture = JSON.parse(
  await readFile(new URL('../../tests/fixtures/solar-events.json', import.meta.url)),
);
const { astronomy } = await import(pathToFileURL(path.resolve(library)).href);
const startJD = 2461041.5,
  endJD = startJD + 365;
const results = [];
let calls = 0;
const started = performance.now();
for (const site of oracle.sites) {
  const predicted = [];
  const uncertain = [];
  for (let day = -1; day <= 365; day++) {
    const jd = startJD + day;
    const native = astronomy.solarDayEvents?.(jd, site.latitudeDeg, site.longitudeDeg);
    const legacy = native ? null : astronomy.sunTimes(jd, site.latitudeDeg, site.longitudeDeg);
    const result = native ?? {
      sunriseJD: legacy.circumpolar ? null : legacy.sunriseJD,
      sunsetJD: legacy.circumpolar ? null : legacy.sunsetJD,
    };
    calls++;
    for (const [key, rising] of [
      ['sunriseJD', true],
      ['sunsetJD', false],
    ]) {
      const statusKey = key === 'sunriseJD' ? 'sunriseStatus' : 'sunsetStatus';
      if (native?.[statusKey] === 'grazing' && jd >= startJD && jd < endJD)
        uncertain.push({
          jd,
          rising,
          cycleStartJD: native.cycleStartJD,
          cycleEndJD: native.cycleEndJD,
        });
      if (result[key] !== null && result[key] >= startJD && result[key] < endJD)
        predicted.push({ jd: result[key], rising });
    }
  }
  predicted.sort((a, b) => a.jd - b.jd);
  const unique = predicted.filter(
    (e, i) =>
      !predicted
        .slice(Math.max(0, i - 2), i)
        .some((p) => p.rising === e.rising && Math.abs(p.jd - e.jd) * 86400 < 1),
  );
  const reference = site.crossings.filter((e) => e.jd >= startJD && e.jd < endJD);
  const used = new Set(),
    errors = [],
    spurious = [];
  for (const candidate of unique) {
    let index = -1,
      distance = Infinity;
    for (let i = 0; i < reference.length; i++) {
      if (used.has(i) || reference[i].rising !== candidate.rising) continue;
      const diff = Math.abs(reference[i].jd - candidate.jd);
      if (diff < distance) {
        index = i;
        distance = diff;
      }
    }
    if (distance < 0.49) {
      used.add(index);
      errors.push({
        ...candidate,
        referenceJD: reference[index].jd,
        errorSeconds: (candidate.jd - reference[index].jd) * 86400,
      });
    } else spurious.push(candidate);
  }
  const withheld = reference.filter(
    (e, i) =>
      !used.has(i) &&
      uncertain.some(
        // The UI rounds to a minute. Allow that resolution at the modeled
        // cycle edges: an ephemeris minimum can lie seconds beyond this one.
        (u) =>
          u.rising === e.rising &&
          e.jd >= u.cycleStartJD - 1 / 1440 &&
          e.jd <= u.cycleEndJD + 1 / 1440,
      ),
  );
  const missing = reference.filter((e, i) => !used.has(i) && !withheld.includes(e));
  results.push({
    name: site.name,
    latitudeDeg: site.latitudeDeg,
    longitudeDeg: site.longitudeDeg,
    referenceEvents: reference.length,
    predictedEvents: unique.length,
    pairedEvents: errors.length,
    missing,
    withheld,
    uncertain,
    spurious,
    over60Seconds: errors.filter((e) => Math.abs(e.errorSeconds) > 60).length,
    over300Seconds: errors.filter((e) => Math.abs(e.errorSeconds) > 300).length,
    maxErrorSeconds: Math.max(0, ...errors.map((e) => Math.abs(e.errorSeconds))),
    worst: errors.sort((a, b) => Math.abs(b.errorSeconds) - Math.abs(a.errorSeconds)).slice(0, 2),
  });
}
const elapsedMs = performance.now() - started;
const controls = fixture.cases.map((row) => ({
  name: row.name,
  result:
    astronomy.solarDayEvents?.(row.jd, row.latitudeDeg, row.longitudeDeg) ??
    astronomy.sunTimes(row.jd, row.latitudeDeg, row.longitudeDeg),
}));
const sum = (field) => results.reduce((n, r) => n + r[field], 0);
const result = {
  oracleSha256: createHash('sha256').update(bytes).digest('hex'),
  provenance: oracle.provenance,
  model: astronomy.solarDayEvents ? 'event roots' : 'noon declination',
  year: oracle.year,
  grazingCycleEdgeToleranceSeconds: 60,
  sites: results.length,
  calls,
  elapsedMs,
  referenceEvents: sum('referenceEvents'),
  predictedEvents: sum('predictedEvents'),
  pairedEvents: sum('pairedEvents'),
  withheldEvents: results.reduce((n, r) => n + r.withheld.length, 0),
  grazingBoundaries: results.reduce((n, r) => n + r.uncertain.length, 0),
  missingEvents: results.reduce((n, r) => n + r.missing.length, 0),
  spuriousEvents: results.reduce((n, r) => n + r.spurious.length, 0),
  eventsOver60Seconds: sum('over60Seconds'),
  eventsOver300Seconds: sum('over300Seconds'),
  maxErrorSeconds: Math.max(...results.map((r) => r.maxErrorSeconds)),
  controls,
  results,
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'replay.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    model: result.model,
    sites: result.sites,
    calls,
    elapsedMs,
    missing: result.missingEvents,
    withheld: result.withheldEvents,
    spurious: result.spuriousEvents,
    eventsOver5min: result.eventsOver300Seconds,
    maxErrorMinutes: result.maxErrorSeconds / 60,
  }),
);
