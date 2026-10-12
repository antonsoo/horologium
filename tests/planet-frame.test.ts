import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANETS, planetLongitude } from '../src/lib/astronomy/planets.js';
import { eclipticOfDate } from '../src/lib/astronomy/precession.js';

type Vector = readonly [number, number, number];
const fixture: {
  jd: number[];
  positions: { name: string; meanOfDate: number[]; apparentOfDate: number[] }[];
  transforms: { jd: number; input: Vector; expected: Vector }[];
} = JSON.parse(
  readFileSync(new URL('../studies/planet-frame/oracle.json', import.meta.url), 'utf8'),
);
const distance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('planet pointers share the date-dependent zodiac frame', () => {
  it('rotates inclined vectors like the independent compiled ERFA ecm06 matrices', () => {
    for (const row of fixture.transforms) {
      const actual = eclipticOfDate(row.input, (row.jd - 2451545) / 36525);
      for (const i of [0, 1, 2] as const)
        expect(Math.abs(actual[i] - row.expected[i])).toBeLessThan(1e-10);
      expect(Math.hypot(...actual)).toBeCloseTo(Math.hypot(...row.input), 14);
    }
  });

  for (const planet of PLANETS) {
    it(`${planet.name}: bounds remaining orbital error against DE440s at 2,755 dates`, () => {
      const reference = fixture.positions.find((row) => row.name === planet.name.toLowerCase());
      // Bounds for this retained grid, not a guarantee at every instant. The
      // model omits perturbations/apparent effects; near a sector edge even
      // this residual error can put a pointer on the other side of the line.
      const bound = { Mercury: 0.04, Venus: 0.04, Mars: 0.08, Jupiter: 0.2, Saturn: 0.26 }[
        planet.name
      ];
      assert.ok(reference && bound !== undefined);
      for (const [i, jd] of fixture.jd.entries()) {
        const actual = planetLongitude(planet, jd);
        const mean: number | undefined = reference.meanOfDate[i];
        const apparent: number | undefined = reference.apparentOfDate[i];
        assert.ok(mean !== undefined && apparent !== undefined);
        expect(distance(actual, mean)).toBeLessThan(bound);
        expect(distance(actual, apparent)).toBeLessThan(bound);
      }
    });
  }
});
