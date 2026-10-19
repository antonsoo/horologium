import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planetModel, planetPositions } from '../src/lib/astronomy/planets.js';
import { eclipticOfDate } from '../src/lib/astronomy/precession.js';
import { gregorianToJD } from '../src/lib/core/jd.js';

const oracle: {
  positions: {
    name: string;
    jd: number;
    longitudeDeg: number;
    table2VectorJ2000: [number, number, number];
  }[];
} = JSON.parse(
  readFileSync(new URL('../studies/long-range-planets/oracle.json', import.meta.url), 'utf8'),
);
const distance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('date-selected planetary fits', () => {
  it('agrees with pinned DE441 at ancient dates and an independent source-table calculation', () => {
    const bounds: Record<string, number> = {
      Mercury: 0.02,
      Venus: 0.065,
      Mars: 0.11,
      Jupiter: 0.26,
      Saturn: 0.4,
    };
    for (const row of oracle.positions) {
      const result = planetPositions(row.jd);
      if (result.model.id === 'jpl-1800-2050') continue;
      const actual = result.positions.find((p) => p.name === row.name);
      assert.ok(actual);
      const [x, y] = eclipticOfDate(row.table2VectorJ2000, (row.jd - 2451545) / 36525);
      const independentFit = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      expect(distance(actual.longitudeDeg, independentFit)).toBeLessThan(1e-8);
      if (result.model.inRange) {
        const bound = bounds[row.name];
        assert.ok(bound);
        expect(distance(actual.longitudeDeg, row.longitudeDeg)).toBeLessThan(bound);
      }
    }
  });

  it('selects the modern fit at inclusive January 1 epochs and retains explicit coverage', () => {
    const from = gregorianToJD(1800, 1, 1),
      to = gregorianToJD(2050, 1, 1);
    for (const jd of [from, from + 0.001, to - 0.001, to])
      expect(planetModel(jd).id).toBe('jpl-1800-2050');
    for (const jd of [from - 0.001, to + 0.001])
      expect(planetModel(jd).id).toBe('jpl-3000bce-3000ce');
    const first = gregorianToJD(-2999, 1, 1),
      last = gregorianToJD(3000, 1, 1);
    for (const jd of [first, last]) expect(planetModel(jd).inRange).toBe(true);
    for (const jd of [first - 0.001, last + 0.001]) expect(planetModel(jd).inRange).toBe(false);
  });

  it('keeps the full clock range usable while labelling extrapolation', () => {
    for (const year of [-5000, 5000]) {
      const result = planetPositions(gregorianToJD(year, 1, 1));
      expect(result.model.inRange).toBe(false);
      for (const p of result.positions) expect(Number.isFinite(p.longitudeDeg)).toBe(true);
    }
    for (const jd of [NaN, Infinity, -Infinity, 1e308])
      expect(() => planetPositions(jd)).toThrow(RangeError);
  });
});
