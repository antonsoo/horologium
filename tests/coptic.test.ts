import { describe, expect, it } from 'vitest';
import {
  COPTIC_EPOCH_JD,
  COPTIC_MONTH_NAMES,
  ETHIOPIAN_EPOCH_JD,
  ETHIOPIAN_MONTH_NAMES,
  copticFromJD,
  copticToJD,
  describeCoptic,
  describeEthiopian,
  ethiopianFromJD,
  ethiopianToJD,
} from '../src/lib/coptic.js';
import { gregorianToJD, julianToJD } from '../src/lib/core/jd.js';

describe('coptic calendar round-trip', () => {
  it('recovers the JD for a spread of ~200 dates across +/-5000 years', () => {
    let checked = 0;
    for (let year = -5000; year <= 5000; year += 50) {
      const month = ((year % 13) + 13) % 13 || 13;
      const jd = copticToJD({ year, month, day: 1 });
      const date = copticFromJD(jd);
      const back = copticToJD(date);
      expect(back).toBeCloseTo(jd, 6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('ethiopian calendar round-trip', () => {
  it('recovers the JD for a spread of ~200 dates across +/-5000 years', () => {
    let checked = 0;
    for (let year = -5000; year <= 5000; year += 50) {
      const month = ((year % 13) + 13) % 13 || 13;
      const jd = ethiopianToJD({ year, month, day: 1 });
      const date = ethiopianFromJD(jd);
      const back = ethiopianToJD(date);
      expect(back).toBeCloseTo(jd, 6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('coptic calendar hand-checked dates', () => {
  it('1 Thout AM 1 is the epoch JD, 29 August 284 CE Julian', () => {
    const date = copticFromJD(COPTIC_EPOCH_JD);
    expect(date).toEqual({ year: 1, month: 1, day: 1 });
    expect(julianToJD(284, 8, 29)).toBe(COPTIC_EPOCH_JD);
  });

  it('a leap year epagomenal month has 6 days, round-tripping day 6', () => {
    // AM year 3: (3+1) mod 4 == 0, so it's leap.
    const jd = copticToJD({ year: 3, month: 13, day: 6 });
    expect(copticFromJD(jd)).toEqual({ year: 3, month: 13, day: 6 });
  });

  it('describe reports "<day> <month> <year> AM"', () => {
    const jd = copticToJD({ year: 1742, month: 1, day: 1 });
    const tablet = describeCoptic(jd);
    expect(tablet.transliteration).toBe(`1 ${COPTIC_MONTH_NAMES[0]} 1742 AM`);
    expect(tablet.id).toBe('coptic');
    expect(tablet.isReconstruction).toBe(false);
  });
});

describe('ethiopian calendar hand-checked dates', () => {
  it('1 Meskerem year 1 is the epoch JD, 29 August 8 CE Julian', () => {
    const date = ethiopianFromJD(ETHIOPIAN_EPOCH_JD);
    expect(date).toEqual({ year: 1, month: 1, day: 1 });
    expect(julianToJD(8, 8, 29)).toBe(ETHIOPIAN_EPOCH_JD);
  });

  it('Ethiopian New Year falls around 11/12 September (Gregorian), matching the well-known modern fact', () => {
    // Ethiopian year 2016's New Year precedes the Gregorian leap year 2024, so it's 12 September;
    // years 2015, 2017, 2018 fall on 11 September. These are independently well-documented facts.
    const cases: Array<[number, number, number, number]> = [
      [2015, 2022, 9, 11],
      [2016, 2023, 9, 12],
      [2017, 2024, 9, 11],
      [2018, 2025, 9, 11],
    ];
    for (const [ethYear, gYear, gMonth, gDay] of cases) {
      const jd = ethiopianToJD({ year: ethYear, month: 1, day: 1 });
      expect(jd).toBeCloseTo(gregorianToJD(gYear, gMonth, gDay), 6);
    }
  });

  it('describe reports "<day> <month> <year>"', () => {
    const jd = ethiopianToJD({ year: 2018, month: 1, day: 1 });
    const tablet = describeEthiopian(jd);
    expect(tablet.transliteration).toBe(`1 ${ETHIOPIAN_MONTH_NAMES[0]} 2018`);
    expect(tablet.id).toBe('ethiopian');
    expect(tablet.isReconstruction).toBe(false);
  });
});
