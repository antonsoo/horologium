/**
 * Cross-checks this project's low-precision Sun/Moon/planet formulas
 * against Skyfield + the JPL DE421 ephemeris (real numerical integration,
 * not another approximation). Fixtures cover 1900-2053 (DE421's range);
 * see scripts/generate_fixtures.py. We measure and print the actual
 * deviation rather than asserting an arbitrary tight bound, and gate on a
 * generous ceiling consistent with each method's documented precision.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLANETS, planetLongitude } from '../src/lib/astronomy/planets.js';
import { moonLongitude, sunLongitude } from '../src/lib/astronomy/sun-moon.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
interface Fixture {
  jd: number;
  longitudes: Record<string, number>;
}
const fixtures: Fixture[] = JSON.parse(
  readFileSync(`${fixturesDir}astronomy-longitudes.json`, 'utf-8'),
);

function angularDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b + 180) % 360) + ((a - b + 180) % 360 < 0 ? 360 : 0) - 180);
  return d;
}

function maxError(ours: (jd: number) => number, key: string): number {
  let max = 0;
  for (const f of fixtures) {
    const diff = angularDiffDeg(ours(f.jd), f.longitudes[key] as number);
    max = Math.max(max, diff);
  }
  return max;
}

describe('astronomy: geocentric ecliptic longitudes vs Skyfield/DE421', () => {
  it('Sun longitude within 0.02 deg (Meeus low-precision method’s own stated accuracy)', () => {
    const err = maxError(sunLongitude, 'sun');
    // eslint-disable-next-line no-console
    console.log(`Sun max error over ${fixtures.length} dates: ${err.toFixed(4)} deg`);
    expect(err).toBeLessThan(0.02);
  });

  it('Moon longitude within 1 deg (10-term truncated series; measured max ~0.68 deg over 1900-2053)', () => {
    const err = maxError(moonLongitude, 'moon');
    // eslint-disable-next-line no-console
    console.log(`Moon max error over ${fixtures.length} dates: ${err.toFixed(4)} deg`);
    expect(err).toBeLessThan(1);
  });

  for (const planet of PLANETS) {
    it(`${planet.name} longitude within 2 deg (Standish 1800-2050 low-order fit, two-body only)`, () => {
      const key = planet.name.toLowerCase();
      const err = maxError((jd) => planetLongitude(planet, jd), key);
      // eslint-disable-next-line no-console
      console.log(`${planet.name} max error over ${fixtures.length} dates: ${err.toFixed(4)} deg`);
      expect(err).toBeLessThan(2);
    });
  }
});
