import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { moonLongitude, moonPhase, nextNewMoon } from '../src/lib/astronomy/sun-moon.js';
import { fromJD as babylonianFromJD } from '../src/lib/babylonian.js';
import { atticFromJD } from '../src/lib/greek.js';

const reference: {
  jd: number[];
  meanLongitude: number[];
  apparentLongitude: number[];
  newMoonsTT: number[];
  clock2026: { jdUTC: number; apparentLongitude: number }[];
  modernConjunctionsUTC: { jdUTC: number }[];
} = JSON.parse(
  readFileSync(new URL('../studies/lunar-series/oracle.json', import.meta.url), 'utf8'),
);
const distance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('lunar series against independent JPL DE440s', () => {
  it('keeps the mean-equinox longitude within 0.005 degree on the retained 1900-2100 grid', () => {
    const errors = reference.meanLongitude.map((longitude, i) =>
      distance(moonLongitude(reference.jd[i] as number), longitude),
    );
    expect(Math.max(...errors)).toBeLessThan(0.005);
  });
  it('bounds the separate actual-UTC clock error, including omitted TT conversion and nutation', () => {
    const errors = reference.clock2026.map((row) =>
      distance(moonLongitude(row.jdUTC), row.apparentLongitude),
    );
    expect(Math.max(...errors)).toBeLessThan(0.02);
  });
  it('does not reset lunar age 40 minutes before independent April 2026 conjunction', () => {
    const jd = 2461147.995109052 - 40 / 1440;
    expect(moonPhase(jd).ageDays).toBeGreaterThan(29);
  });
  it('places the retained 2,487 conjunctions within two minutes at equal TT arguments', () => {
    const errors = reference.newMoonsTT.map((jd) => Math.abs(nextNewMoon(jd - 1) - jd) * 1440);
    expect(Math.max(...errors)).toBeLessThan(2);
  });

  it.each([
    ['Babylonian', 2458873.876590278, 44.4275, babylonianFromJD],
    ['Attic', 2459848.9340902776, 23.7275, atticFromJD],
  ] as const)(
    '%s month day follows the independently calculated conjunction day',
    (_name, jd, longitude, calendar) => {
      const conjunction = reference.modernConjunctionsUTC.find(
        (event) => Math.abs(event.jdUTC - jd) < 1,
      );
      expect(conjunction).toBeDefined();
      if (!conjunction) return;
      const localDay = (time: number) => Math.floor(time + longitude / 360 + 0.5);
      expect(calendar(jd).day).toBe(localDay(jd) - localDay(conjunction.jdUTC) + 1);
    },
  );
});
