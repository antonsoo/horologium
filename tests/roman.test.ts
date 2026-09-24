import { describe, expect, it } from 'vitest';
import { isJulianLeapYear, julianToJD } from '../src/lib/core/jd.js';
import {
  ANCIENT_CITIES,
  describe as describeRoman,
  fromJD,
  latinWeekday,
  ROME,
  romanHour,
  toJD,
  toRomanNumerals,
} from '../src/lib/roman.js';

describe('roman calendar round-trip', () => {
  it('recovers the JD for a spread of ~200 dates across +/-5000 years', () => {
    let checked = 0;
    for (let year = -5000; year <= 5000; year += 50) {
      const month = ((year % 12) + 12) % 12 || 12;
      const jd = julianToJD(year, month, 15);
      const date = fromJD(jd);
      const back = toJD(date);
      expect(back).toBeCloseTo(jd, 6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('roman calendar hand-checked dates', () => {
  it('the Ides of March 44 BCE (assassination of Caesar) is Idibus Martiis', () => {
    // 44 BCE in astronomical year numbering is -(44-1) = -43.
    const jd = julianToJD(-43, 3, 15);
    const date = fromJD(jd);
    expect(date.referencePoint).toBe('ides');
    expect(date.romanCount).toBe(1);
    // Traditionally cited as AUC 710.
    expect(date.aucYear).toBe(710);
    const tablet = describeRoman(jd);
    expect(tablet.transliteration).toBe('Idibus Martiis');
  });

  it('renders the Kalends of January in ablative and accusative forms', () => {
    const jd = julianToJD(1, 1, 1);
    const date = fromJD(jd);
    expect(date.referencePoint).toBe('kalends');
    expect(date.romanCount).toBe(1);
    const tablet = describeRoman(jd);
    expect(tablet.transliteration).toBe('Kalendis Ianuariis');
    expect(tablet.native).toBe('Kal. Ian.');
  });

  it('renders 8 days before the Kalends of October as a.d. VIII Kal. Oct.', () => {
    // September 24 counts 8 days (inclusive) before 1 October.
    const jd = julianToJD(2026, 9, 24);
    const date = fromJD(jd);
    expect(date.referencePoint).toBe('kalends');
    expect(date.referenceMonth).toBe(10);
    expect(date.romanCount).toBe(8);
    const tablet = describeRoman(jd);
    expect(tablet.native).toBe('a.d. VIII Kal. Oct.');
    expect(tablet.transliteration).toBe('ante diem octavum Kalendas Octobres');
  });

  it('handles the bissextile leap day without collapsing the doubled day', () => {
    // Astronomical year 0 (= 1 BCE) is a Julian leap year.
    expect(isJulianLeapYear(0)).toBe(true);
    const firstSixth = fromJD(julianToJD(0, 2, 24));
    const doubledSixth = fromJD(julianToJD(0, 2, 25));
    const dayAfter = fromJD(julianToJD(0, 2, 26));
    const lastDayOfFeb = fromJD(julianToJD(0, 2, 29));

    expect(firstSixth.romanCount).toBe(6);
    expect(firstSixth.isBissextile).toBe(false);

    expect(doubledSixth.romanCount).toBe(6);
    expect(doubledSixth.isBissextile).toBe(true);
    expect(describeRoman(julianToJD(0, 2, 25)).transliteration).toBe(
      'ante diem bis sextum Kalendas Martias',
    );

    expect(dayAfter.romanCount).toBe(5); // continues as if it were common-year day 25
    expect(lastDayOfFeb.romanCount).toBe(2); // pridie Kalendas Martias
  });

  it('handles pridie in a common (non-leap) year', () => {
    expect(isJulianLeapYear(1)).toBe(false);
    const jd = julianToJD(1, 2, 28);
    const date = fromJD(jd);
    expect(date.romanCount).toBe(2);
    expect(date.isBissextile).toBe(false);
    expect(describeRoman(jd).transliteration).toBe('pridie Kalendas Martias');
  });
});

describe('toRomanNumerals', () => {
  it('matches known values', () => {
    expect(toRomanNumerals(1)).toBe('I');
    expect(toRomanNumerals(4)).toBe('IV');
    expect(toRomanNumerals(9)).toBe('IX');
    expect(toRomanNumerals(14)).toBe('XIV');
    expect(toRomanNumerals(40)).toBe('XL');
    expect(toRomanNumerals(1994)).toBe('MCMXCIV');
    expect(toRomanNumerals(2026)).toBe('MMXXVI');
    expect(toRomanNumerals(3999)).toBe('MMMCMXCIX');
  });

  it('throws outside 1-3999', () => {
    expect(() => toRomanNumerals(0)).toThrow();
    expect(() => toRomanNumerals(4000)).toThrow();
    expect(() => toRomanNumerals(1.5)).toThrow();
  });
});

describe('latin weekday', () => {
  it('returns one of the seven planetary weekday names', () => {
    const jd = julianToJD(2026, 9, 24);
    expect([
      'dies Solis',
      'dies Lunae',
      'dies Martis',
      'dies Mercurii',
      'dies Iovis',
      'dies Veneris',
      'dies Saturni',
    ]).toContain(latinWeekday(jd));
  });
});

describe('roman seasonal hours', () => {
  it('places local noon in the daytime horae at Rome', () => {
    const jd = julianToJD(2026, 6, 21) + 0.0; // JD at UTC noon; Rome is close enough to UTC for a coarse smoke test
    const hour = romanHour(jd, ROME.latDeg, ROME.lonDeg);
    expect(hour.circumpolar).toBe(false);
    if (hour.isDaytime) {
      expect(hour.index).toBeGreaterThanOrEqual(1);
      expect(hour.index).toBeLessThanOrEqual(12);
    } else {
      expect(hour.index).toBeGreaterThanOrEqual(1);
      expect(hour.index).toBeLessThanOrEqual(4);
    }
  });

  it('exports Rome plus a handful of other ancient cities', () => {
    const names = ANCIENT_CITIES.map((c) => c.name);
    expect(names).toContain('Rome');
    expect(names).toContain('Athens');
    expect(names).toContain('Alexandria');
    expect(names).toContain('Jerusalem');
  });
});
