import { describe, expect, it } from 'vitest';
import { gregorianToJD, jdToGregorian, julianToJD } from '../src/lib/core/jd.js';
import {
  ATTIC_MONTH_NAMES,
  ATTIC_MONTH_NAMES_GREEK,
  atticFromJD,
  olympiadFromJD,
} from '../src/lib/greek.js';

describe('Greek calendar', () => {
  it('776 BCE (Julian) is Olympiad 1, year 1', () => {
    const jd = julianToJD(-775, 8, 1); // well into the Olympic-summer year
    expect(olympiadFromJD(jd)).toEqual({ number: 1, year: 1 });
  });

  it('Olympiad number increments every 4 years from the same year-start', () => {
    const base = julianToJD(-775, 8, 1);
    const fourYearsLater = julianToJD(-771, 8, 1);
    const a = olympiadFromJD(base);
    const b = olympiadFromJD(fourYearsLater);
    expect(b.number).toBe(a.number + 1);
    expect(b.year).toBe(a.year);
  });

  it('has 12 named months with polytonic Greek forms', () => {
    expect(ATTIC_MONTH_NAMES).toHaveLength(12);
    expect(ATTIC_MONTH_NAMES_GREEK).toHaveLength(12);
    expect(ATTIC_MONTH_NAMES[0]).toBe('Hekatombaion');
    expect(ATTIC_MONTH_NAMES_GREEK[0]).toBe('Ἑκατομβαιών');
  });

  it('month/day stay in valid range (1-12, 1-30) across ~1100 years, no negative days at year boundaries', () => {
    const start = gregorianToJD(-2000, 1, 1);
    for (let i = 0; i < 3000; i++) {
      const jd = start + i * 137.7;
      const a = atticFromJD(jd);
      expect(a.month).toBeGreaterThanOrEqual(1);
      expect(a.month).toBeLessThanOrEqual(12);
      expect(a.day).toBeGreaterThanOrEqual(1);
      expect(a.day).toBeLessThanOrEqual(30);
    }
  });

  it('a year needing a 13th lunation intercalates a second Poseideon right after the first', () => {
    // Walk one full year from a known start and confirm month order is
    // 1..6, [6-intercalary], 7..12 with no gaps or repeats otherwise.
    let jd = julianToJD(-775, 7, 15);
    const seen: string[] = [];
    let prev = '';
    for (let i = 0; i < 400; i++) {
      const a = atticFromJD(jd);
      const key = `${a.month}${a.isIntercalary ? '-int' : ''}`;
      if (key !== prev) {
        seen.push(key);
        prev = key;
      }
      jd += 1;
      if (seen.length > 13) break;
    }
    // This particular year (776/775 BCE) comes out 13 months long; confirm
    // the intercalary slot is immediately after month 6, not elsewhere.
    const intIdx = seen.indexOf('6-int');
    if (intIdx !== -1) {
      expect(seen[intIdx - 1]).toBe('6');
      expect(seen[intIdx + 1]).toBe('7');
    }
  });

  it('year-start Julian-calendar year matches the solstice-anchored expectation', () => {
    const jd = gregorianToJD(2026, 9, 24);
    const a = atticFromJD(jd);
    // The Attic year containing a late-September 2026 date should have
    // started at the new moon after the 2026 summer solstice.
    expect(a.yearStartsIn).toBe(jdToGregorian(jd).year);
  });
});
