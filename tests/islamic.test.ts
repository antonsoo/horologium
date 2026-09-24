import { describe, expect, it } from 'vitest';
import { jdWeekday, julianToJD } from '../src/lib/core/jd.js';
import {
  describe as describeIslamic,
  fromJD,
  ISLAMIC_EPOCH_JD,
  ISLAMIC_MONTH_NAMES,
  islamicLeapYear,
  toJD,
} from '../src/lib/islamic.js';

describe('islamic calendar round-trip', () => {
  it('recovers the JD for a spread of ~200 dates across +/-5000 years worth of AH', () => {
    // Islamic years run ~3% shorter than solar years, so +/-5000 years of span
    // needs a correspondingly wider AH range; step to land >=200 samples.
    let checked = 0;
    for (let year = -3800; year <= 5800; year += 48) {
      const month = ((year % 12) + 12) % 12 || 12;
      const jd = toJD({ year, month, day: 1 });
      const date = fromJD(jd);
      const back = toJD(date);
      expect(back).toBeCloseTo(jd, 6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('islamic calendar hand-checked dates', () => {
  it('1 Muharram AH 1 is the epoch JD, 16 July 622 CE Julian', () => {
    const date = fromJD(ISLAMIC_EPOCH_JD);
    expect(date).toEqual({ year: 1, month: 1, day: 1 });
    expect(toJD(date)).toBe(ISLAMIC_EPOCH_JD);
    expect(julianToJD(622, 7, 16)).toBe(ISLAMIC_EPOCH_JD);
  });

  it('the epoch fell on a Friday, matching the traditional account of the Hijra date', () => {
    expect(jdWeekday(ISLAMIC_EPOCH_JD)).toBe(5); // 0=Sunday .. 5=Friday
  });

  it('the leap-year test matches the specified 30-year-cycle positions', () => {
    const leapPositions = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
    const found: number[] = [];
    for (let y = 1; y <= 30; y++) {
      if (islamicLeapYear(y)) found.push(y);
    }
    expect(found).toEqual(leapPositions);
  });

  it('a leap year Dhu al-Hijjah has 30 days, matched by round-tripping day 30', () => {
    const leapYear = 2; // first leap year in the cycle
    expect(islamicLeapYear(leapYear)).toBe(true);
    const jd = toJD({ year: leapYear, month: 12, day: 30 });
    expect(fromJD(jd)).toEqual({ year: leapYear, month: 12, day: 30 });
  });

  it('describe() reports "<day> <month> <year> AH" using the tabular month names', () => {
    const jd = toJD({ year: 1446, month: 9, day: 14 });
    const tablet = describeIslamic(jd);
    expect(tablet.transliteration).toBe('14 Ramadan 1446 AH');
    expect(ISLAMIC_MONTH_NAMES[8]).toBe('Ramadan');
    expect(tablet.method.toLowerCase()).toContain('tabular');
    expect(tablet.isReconstruction).toBe(false);
  });

  it("describe()'s body line is the observational-calendar caveat, not a repeat of the date", () => {
    const jd = toJD({ year: 1446, month: 9, day: 14 });
    const tablet = describeIslamic(jd);
    expect(tablet.summary).not.toContain('14 Ramadan 1446');
    expect(tablet.summary.toLowerCase()).toContain('moon-sighting');
  });
});
