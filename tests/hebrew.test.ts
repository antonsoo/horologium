import { describe, expect, it } from 'vitest';
import { gregorianToJD, jdToGregorian } from '../src/lib/core/jd.js';
import {
  fromJD,
  isHebrewLeapYear,
  monthName,
  roshHashanah,
  toHebrewNumeral,
  toJD,
} from '../src/lib/hebrew.js';

describe('Hebrew calendar: reference dates', () => {
  it('Rosh Hashanah 5785 falls on 3 October 2024 (Gregorian)', () => {
    const expectedJD = gregorianToJD(2024, 10, 3);
    expect(roshHashanah(5785)).toBe(expectedJD);

    const date = fromJD(expectedJD);
    expect(date).toEqual({ year: 5785, month: 7, day: 1 });
  });

  it('Passover (15 Nisan) 5784 falls on 23 April 2024 (Gregorian)', () => {
    const jd = toJD({ year: 5784, month: 1, day: 15 });
    expect(jdToGregorian(jd)).toEqual({ year: 2024, month: 4, day: 23 });
    expect(jd).toBe(gregorianToJD(2024, 4, 23));
  });
});

describe('Hebrew calendar: leap years', () => {
  it('produces exactly {3,6,8,11,14,17,19(=0)} within each 19-year cycle', () => {
    const leapPositions = new Set<number>();
    for (let y = 1; y <= 19; y++) {
      if (isHebrewLeapYear(y)) leapPositions.add(y);
    }
    expect(leapPositions).toEqual(new Set([3, 6, 8, 11, 14, 17, 19]));
  });

  it('5784 is a leap year (13 months) and 5785 is not', () => {
    expect(isHebrewLeapYear(5784)).toBe(true);
    expect(isHebrewLeapYear(5785)).toBe(false);
  });
});

describe('Hebrew calendar: month naming', () => {
  it('disambiguates Adar I/II in a leap year vs plain Adar otherwise', () => {
    expect(monthName(5784, 12)).toBe('Adar I');
    expect(monthName(5784, 13)).toBe('Adar II');
    expect(monthName(5785, 12)).toBe('Adar');
  });
});

describe('Hebrew calendar: Hebrew numerals', () => {
  it('renders 5785 as תשפ״ה (thousands dropped)', () => {
    expect(toHebrewNumeral(5785)).toBe('תשפ״ה');
  });

  it('uses the tet-vav/tet-zayin substitution for 15 and 16', () => {
    expect(toHebrewNumeral(15)).toBe('ט״ו');
    expect(toHebrewNumeral(16)).toBe('ט״ז');
  });

  it('appends a geresh to single-letter numerals', () => {
    expect(toHebrewNumeral(5)).toBe('ה׳');
  });
});

describe('Hebrew calendar: round trip', () => {
  it('toJD(fromJD(jd)) === jd across ~200 whole-day JDs spanning ~5000 years either side', () => {
    const start = gregorianToJD(-3000, 1, 1);
    const end = gregorianToJD(7000, 1, 1);
    const count = 200;
    for (let i = 0; i < count; i++) {
      const raw = start + ((end - start) * i) / (count - 1);
      const jd = Math.floor(raw) + 0.5;
      const date = fromJD(jd);
      expect(toJD(date)).toBe(jd);
    }
  });
});
