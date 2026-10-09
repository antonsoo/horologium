import { describe, expect, it } from 'vitest';
import {
  chineseFromJD,
  chineseNewYear,
  inspectChineseYear,
  sexagenaryDay,
  sexagenaryYear,
} from '../src/lib/chinese.js';
import { dateToJD, gregorianToJD, jdToDate } from '../src/lib/core/jd.js';

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
    expect(jd).toBe(gregorianToJD(2000, 2, 5) - 1 / 3);
  });

  it('day sexagenary cycle repeats every 60 days', () => {
    const jd = gregorianToJD(2026, 9, 24);
    expect(sexagenaryDay(jd).index).toBe(sexagenaryDay(jd + 60).index);
  });

  it('year sexagenary cycle repeats every 60 years', () => {
    expect(sexagenaryYear(2024).index).toBe(sexagenaryYear(1964).index);
  });

  it('uses a historically anchored day name, changing with the lunar day at UTC+8 midnight', () => {
    // Y. T. Liu, Sexagenary Cycle, eq. (1): 27 Jan 2019 is jiazi.
    const midnight = gregorianToJD(2019, 1, 27) - 1 / 3;
    expect(sexagenaryDay(midnight - 1 / 86400).han).toBe('癸亥');
    expect(sexagenaryDay(midnight).han).toBe('甲子');
    expect(sexagenaryDay(midnight + 1 - 1 / 86400).han).toBe('甲子');
    expect(sexagenaryDay(midnight + 1).han).toBe('乙丑');
  });

  it('changes year and month at midnight, hours before the 2024 new moon', () => {
    const instant = dateToJD(new Date('2024-02-09T16:00:00Z'));
    expect(chineseFromJD(instant - 1 / 86400)).toMatchObject({
      yearNumber: 2023,
      month: 12,
      day: 30,
    });
    expect(chineseFromJD(instant)).toMatchObject({ yearNumber: 2024, month: 1, day: 1 });
    expect(chineseFromJD(instant + 6 / 24)).toMatchObject({ yearNumber: 2024, month: 1, day: 1 });
    expect(chineseFromJD(instant).dayGanzhi.han).toBe('甲辰');
  });

  it('keeps 2033 month 8 regular and assigns the leap month to 11', () => {
    const year = inspectChineseYear(2033);
    expect(year.months.filter((m) => m.isLeapMonth).map((m) => m.month)).toEqual([11]);
    expect(year.months.find((m) => m.month === 8)).toMatchObject({
      isLeapMonth: false,
      principalTerms: [],
      monthsInSolsticeCycle: 12,
      rule: 'twelve-month-cycle',
    });
    const regular11 = year.months.find((m) => m.month === 11 && !m.isLeapMonth);
    expect(regular11?.principalTerms.map((t) => t.name)).toEqual(['Minor snow', 'Winter solstice']);
    const leap11 = year.months.find((m) => m.isLeapMonth);
    expect(leap11).toMatchObject({
      principalTerms: [],
      monthsInSolsticeCycle: 13,
      rule: 'leap-month',
    });
    expect(leap11?.startJD).toBe(gregorianToJD(2033, 12, 22) - 1 / 3);
    const midnight = leap11?.startJD as number;
    expect(chineseFromJD(midnight - 1 / 86400)).toMatchObject({
      month: 11,
      isLeapMonth: false,
      day: 30,
    });
    expect(chineseFromJD(midnight)).toMatchObject({ month: 11, isLeapMonth: true, day: 1 });
    expect(inspectChineseYear(2034).months[0]?.rule).toBe('leap-already-assigned');
  });

  it('returns a reusable, accurate civil New Year instant, including 2027', () => {
    expect(jdToDate(chineseNewYear(2027)).toISOString()).toBe('2027-02-05T16:00:00.000Z');
    expect(jdToDate(chineseNewYear(2033)).toISOString()).toBe('2033-01-30T16:00:00.000Z');
  });

  it('flags the published near-midnight 2057 new moon and both affected month boundaries', () => {
    const months = inspectChineseYear(2057).months;
    const boundary = gregorianToJD(2057, 9, 28) - 1 / 3;
    const month = months.find((m) => m.startJD === boundary);
    const previous = months.find((m) => m.endJD === boundary);
    expect(month?.nearMidnight.some((f) => f.kind === 'new-moon')).toBe(true);
    expect(previous?.nearMidnight.some((f) => f.kind === 'next-new-moon')).toBe(true);
  });

  it('does not let a consumer mutate cached calendar evidence', () => {
    const original = inspectChineseYear(2033);
    const modified = inspectChineseYear(2033);
    const first = modified.months[0];
    const term = modified.months[1]?.principalTerms[0];
    if (!first || !term) throw new Error('Missing expected month/term in the 2033 inspection');
    first.startJD = 0;
    term.name = 'changed';
    modified.months.pop();
    expect(inspectChineseYear(2033)).toEqual(original);
    expect(chineseFromJD(gregorianToJD(2033, 1, 31)).month).toBe(1);
  });

  it('keeps a complete, contiguous civil month sequence across the clock range', () => {
    for (let year = -5000; year <= 5000; year += 101) {
      const result = inspectChineseYear(year);
      expect([12, 13]).toContain(result.months.length);
      expect(result.months[0]?.startJD).toBe(result.startJD);
      expect(result.months.at(-1)?.endJD).toBe(result.endJD);
      for (const [i, month] of result.months.entries()) {
        expect([29, 30]).toContain(month.days);
        if (i) expect(month.startJD).toBe(result.months[i - 1]?.endJD);
        expect(chineseFromJD(month.startJD + 0.5)).toMatchObject({
          yearNumber: year,
          month: month.month,
          isLeapMonth: month.isLeapMonth,
          day: 1,
        });
      }
    }
    expect(chineseFromJD(gregorianToJD(-5000, 1, 1)).yearNumber).toBe(-5001);
    expect(inspectChineseYear(-5001).months.length).toBeGreaterThanOrEqual(12);
    expect(chineseFromJD(gregorianToJD(5001, 1, 1) - 1 / 86400).day).toBeGreaterThan(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e300])(
    'rejects an unrepresentable instant %s without unbounded searching',
    (jd) => {
      expect(() => chineseFromJD(jd)).toThrow(RangeError);
      expect(() => sexagenaryDay(jd)).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2026.5, -5002, 5001])(
    'rejects an invalid inspection year %s',
    (year) => {
      expect(() => inspectChineseYear(year)).toThrow(RangeError);
      expect(() => chineseNewYear(year)).toThrow(RangeError);
    },
  );
});
