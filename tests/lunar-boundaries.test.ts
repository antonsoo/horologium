import { describe, expect, it } from 'vitest';
import { moonPhase, nextNewMoon, previousNewMoon } from '../src/lib/astronomy/sun-moon.js';
import * as babylonian from '../src/lib/babylonian.js';
import { gregorianToJD, julianToJD } from '../src/lib/core/jd.js';
import * as greek from '../src/lib/greek.js';

describe('new-moon search intervals', () => {
  it('keeps events one second or five minutes from the requested instant', () => {
    const event = nextNewMoon(gregorianToJD(2026, 1, 1));
    for (const seconds of [1, 300]) {
      const before = event - seconds / 86400;
      const after = event + seconds / 86400;
      expect(Math.abs(nextNewMoon(before) - event) * 86400).toBeLessThan(0.001);
      expect(Math.abs(previousNewMoon(after) - event) * 86400).toBeLessThan(0.001);
      expect(moonPhase(after).ageDays * 86400).toBeCloseTo(seconds, 3);
      expect(moonPhase(before).ageDays).toBeGreaterThan(29);
    }
  });

  it('reuses its crossing as an inclusive next boundary and a strict previous boundary', () => {
    for (const year of [-5000, -775, 0, 2026, 5000]) {
      const event = nextNewMoon(gregorianToJD(year, 1, 1));
      expect(nextNewMoon(event)).toBe(event);
      expect(moonPhase(event).ageDays).toBe(0);
      expect(event - previousNewMoon(event)).toBeGreaterThan(29);
    }
  });

  it('rejects nonfinite search dates instead of returning an invented event', () => {
    for (const jd of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => nextNewMoon(jd)).toThrow(RangeError);
      expect(() => previousNewMoon(jd)).toThrow(RangeError);
    }
  });
});

describe('reconstructed civil years', () => {
  it('finds the current year equinox even when it falls after May 1 Julian', () => {
    expect(babylonian.fromJD(julianToJD(-5000, 6, 1)).seYear).toBe(-4689);
  });
  it('starts Babylonian year/month/day together at mean midnight, before the new moon', () => {
    // Independent daily-grid roots retained in studies/lunar-boundaries.
    const event = 2461147.936762288;
    const midnight = Math.floor(event + 44.4275 / 360 + 0.5) - 0.5 - 44.4275 / 360;
    expect(babylonian.fromJD(midnight - 1 / 86400)).toEqual({
      seYear: 2336,
      month: 12,
      isIntercalary: true,
      day: 29,
    });
    for (const jd of [midnight + 1 / 86400, event - 1 / 86400, event + 1 / 86400]) {
      expect(babylonian.fromJD(jd)).toEqual({
        seYear: 2337,
        month: 1,
        isIntercalary: false,
        day: 1,
      });
    }
  });

  it('keeps Olympiad and Attic year together between solstice and Hekatombaion', () => {
    const jd = 2461224.396031973;
    expect(greek.atticFromJD(jd).yearStartsIn).toBe(2025);
    expect(greek.olympiadFromJD(jd)).toEqual({ number: 701, year: 1 });
    expect(greek.describe(jd).summary).toBe('18 Skirophorion, Ol. 701.1 (year begins 2025 CE)');
    const midnight = Math.floor(2461235.9444104666 + 23.7275 / 360 + 0.5) - 0.5 - 23.7275 / 360;
    expect(greek.olympiadFromJD(midnight - 1 / 86400)).toEqual({ number: 701, year: 1 });
    expect(greek.olympiadFromJD(midnight + 1 / 86400)).toEqual({ number: 701, year: 2 });
    expect(greek.atticFromJD(midnight + 1 / 86400)).toEqual({
      yearStartsIn: 2026,
      month: 1,
      isIntercalary: false,
      day: 1,
    });
  });
});
