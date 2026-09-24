import { describe, expect, it } from 'vitest';
import {
  chineseFromJD,
  chineseNewYear,
  sexagenaryDay,
  sexagenaryYear,
} from '../src/lib/chinese.js';
import { gregorianToJD } from '../src/lib/core/jd.js';

describe('Chinese calendar', () => {
  it('1984 is jiazi (index 0) - the year that names the current 60-year cycle', () => {
    expect(sexagenaryYear(1984).han).toBe('甲子');
    expect(sexagenaryYear(1984).index).toBe(0);
  });

  it('2014 has a leap 9th month (well-documented, and astronomically tight: the', () => {
    // bounding solar term (Xiaoxue) and new moon land on the same civil day)
    const d = chineseFromJD(gregorianToJD(2014, 11, 1));
    expect(d.month).toBe(9);
    expect(d.isLeapMonth).toBe(true);
  });

  it('2020 has a leap 4th month (Xiazhi and the new moon land on the same civil day)', () => {
    const d = chineseFromJD(gregorianToJD(2020, 6, 1));
    expect(d.month).toBe(4);
    expect(d.isLeapMonth).toBe(true);
  });

  it('Chinese New Year 2000 is 5 Feb 2000 (Gregorian)', () => {
    const jd = chineseNewYear(2000);
    const g = Math.round(jd - gregorianToJD(2000, 2, 5));
    expect(Math.abs(g)).toBeLessThanOrEqual(1);
  });

  it('day sexagenary cycle repeats every 60 days', () => {
    const jd = gregorianToJD(2026, 9, 24);
    expect(sexagenaryDay(jd).index).toBe(sexagenaryDay(jd + 60).index);
  });

  it('year sexagenary cycle repeats every 60 years', () => {
    expect(sexagenaryYear(2024).index).toBe(sexagenaryYear(1964).index);
  });
});
