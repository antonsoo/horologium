// Properties every calendar has to keep on any day, checked on seeded random days from the
// deep past (before JD 0, where a remainder taken with `%` goes negative) to the far future.
import { describe, expect, it } from 'vitest';
import * as h from '../src/lib/index.js';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
}

const RANGES: ReadonlyArray<readonly [string, number, number]> = [
  ['before JD 0', -1_500_000, 0],
  ['antiquity', 0, 2_000_000],
  ['modern', 2_415_020, 2_488_070],
  ['far future', 2_500_000, 6_000_000],
];

/** Civil days (JD ending in .5) spread over every range. */
function sampleDays(perRange: number): number[] {
  const r = rng(11);
  return RANGES.flatMap(([, lo, hi]) =>
    Array.from({ length: perRange }, () => Math.floor(lo + r() * (hi - lo)) + 0.5),
  );
}

type Codec = readonly [string, (jd: number) => object, (date: never) => number];
const CODECS: readonly Codec[] = [
  ['hebrew', h.hebrew.fromJD, h.hebrew.toJD as never],
  ['islamic', h.islamic.fromJD, h.islamic.toJD as never],
  ['coptic', h.coptic.copticFromJD, h.coptic.copticToJD as never],
  ['ethiopian', h.coptic.ethiopianFromJD, h.coptic.ethiopianToJD as never],
  ['egyptian', h.egyptian.fromJD, h.egyptian.toJD as never],
  ['maya', h.maya.fromJD, h.maya.toJD as never],
  ['roman', h.roman.fromJD, h.roman.toJD as never],
  ['byzantine', h.byzantine.fromJD, h.byzantine.toJD as never],
  ['zoroastrian', h.zoroastrian.fromJD, h.zoroastrian.toJD as never],
];

describe('every calendar, on any day', () => {
  const days = sampleDays(1500);

  it.each(CODECS)(
    '%s: a day converts to a date and back to the same day',
    (_name, fromJD, toJD) => {
      for (const jd of days) expect(toJD(fromJD(jd) as never), `JD ${jd}`).toBe(jd);
    },
  );

  it.each(CODECS)('%s: a date lasts the whole day and no longer', (_name, fromJD) => {
    for (const jd of days) {
      const date = JSON.stringify(fromJD(jd));
      expect(JSON.stringify(fromJD(jd + 0.3)), `JD ${jd}`).toBe(date);
      expect(JSON.stringify(fromJD(jd + 1)), `JD ${jd}`).not.toBe(date);
    }
  });

  it('the Gregorian and Julian conversions invert each other', () => {
    for (const jd of days) {
      const g = h.core.jdToGregorian(jd);
      const j = h.core.jdToJulian(jd);
      expect(h.core.gregorianToJD(g.year, g.month, g.day)).toBe(jd);
      expect(h.core.julianToJD(j.year, j.month, j.day)).toBe(jd);
    }
  });

  it('every tablet renders without a NaN or an undefined in it', () => {
    const tablets = [
      h.roman.describe,
      h.egyptian.describe,
      h.hebrew.describe,
      h.islamic.describe,
      h.maya.describe,
      h.chinese.describe,
      h.greek.describe,
      h.babylonian.describe,
      h.coptic.describeCoptic,
      h.coptic.describeEthiopian,
      h.byzantine.describe,
      h.zoroastrian.describe,
    ]; // prettier-ignore
    for (const jd of days.filter((_, i) => i % 10 === 0)) {
      for (const tablet of tablets) {
        // Arithmetic calendars support this very wide sweep. The Chinese
        // astronomical model has an explicit input range matching the clock.
        if (
          tablet === h.chinese.describe &&
          (jd < h.core.gregorianToJD(-5000, 1, 1) || jd >= h.core.gregorianToJD(5001, 1, 1))
        ) {
          expect(() => tablet(jd)).toThrow(RangeError);
          continue;
        }
        expect(JSON.stringify(tablet(jd)), `JD ${jd}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
});

describe('weekdays before JD 0', () => {
  it('advance one day at a time straight through JD 0', () => {
    // JD 0.0, noon on 1 January 4713 BCE (Julian), was a Monday.
    expect(h.core.jdWeekday(0)).toBe(1);
    for (let jd = -30.5; jd < 30; jd += 1) {
      const today = h.core.jdWeekday(jd);
      expect(today).toBeGreaterThanOrEqual(0);
      expect(today).toBeLessThanOrEqual(6);
      expect(h.core.jdWeekday(jd + 1)).toBe((today + 1) % 7);
    }
    expect(h.roman.latinWeekday(-1_000_000.5)).toMatch(/^dies /);
  });

  it('give every Hebrew year a length the calendar allows', () => {
    // A negative weekday slipped past the postponement rules: 192 of the years before the
    // era came out 356 or 382 days long, and their last day repeated the one before it.
    for (let year = -6000; year <= 6000; year++) {
      const length = h.hebrew.roshHashanah(year + 1) - h.hebrew.roshHashanah(year);
      expect([353, 354, 355, 383, 384, 385], `year ${year}`).toContain(length);
    }
  });
});
