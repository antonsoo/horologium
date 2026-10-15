import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  byzantine,
  coptic,
  core,
  egyptian,
  hebrew,
  islamic,
  roman,
  zoroastrian,
} from '../src/lib/index.js';

type Forward = (year: number, month: number, day: number) => number;
const converters: Record<string, Forward> = {
  gregorian: core.gregorianToJD,
  julian: core.julianToJD,
  hebrew: (year, month, day) => hebrew.toJD({ year, month, day }),
  islamic: (year, month, day) => islamic.toJD({ year, month, day }),
  coptic: (year, month, day) => coptic.copticToJD({ year, month, day }),
  ethiopian: (year, month, day) => coptic.ethiopianToJD({ year, month, day }),
  egyptian: (year, month, day) => egyptian.toJD({ year, month, day }),
  zoroastrian: (year, month, day) => zoroastrian.toJD({ year, month, day }),
  roman: (year, month, day) => roman.toJD({ ...roman.fromJD(2451544.5), year, month, day }),
  byzantine: (year, month, day) =>
    byzantine.toJD({
      ...byzantine.fromJD(2451544.5),
      julianYear: year,
      julianMonth: month,
      julianDay: day,
    }),
};
const fixture = JSON.parse(
  readFileSync(new URL('../studies/forward-dates/months.json', import.meta.url), 'utf8'),
) as {
  months: [string, number, number, number, number][];
};

describe('forward calendar dates', () => {
  it('preserves independent month boundaries and fractional days, and refuses the first nonexistent day', () => {
    for (const [calendar, year, month, days, start] of fixture.months) {
      const names = calendar === 'julian' ? [calendar, 'roman', 'byzantine'] : [calendar];
      for (const name of names) {
        const forward = converters[name];
        if (!forward) throw new Error(`Unknown oracle calendar ${name}`);
        for (const day of [1, 1.25, days, days + 0.75]) {
          expect(forward(year, month, day), `${name} ${year}/${month}/${day}`).toBe(
            start + day - 1,
          );
        }
        expect(
          () => forward(year, month, days + 1),
          `${name} ${year}/${month}/${days + 1}`,
        ).toThrow(RangeError);
      }
    }
  });

  for (const [name, forward] of Object.entries(converters)) {
    it(`${name} rejects malformed fields and unrepresentable dates, then accepts a valid date`, () => {
      const year = name === 'hebrew' ? 5784 : 2025;
      for (const input of [
        [NaN, 1, 1],
        [Infinity, 1, 1],
        [year + 0.5, 1, 1],
        ['2025', 1, 1],
        [true, 1, 1],
        [2 ** 53, 1, 1],
        [Number.MAX_SAFE_INTEGER, 1, 1],
        [year, 0, 1],
        [year, -1, 1],
        [year, 1.5, 1],
        [year, NaN, 1],
        [year, Infinity, 1],
        [year, '1', 1],
        [year, true, 1],
        [year, 14, 1],
        [year, 1, 0],
        [year, 1, -1],
        [year, 1, NaN],
        [year, 1, Infinity],
        [year, 1, '1'],
        [year, 1, true],
      ]) {
        // JavaScript callers do not get TypeScript's field types at runtime.
        const [y, m, d] = input as [number, number, number];
        expect(() => forward(y, m, d)).toThrow(RangeError);
      }
      expect(Number.isFinite(forward(year, 1, 1.1))).toBe(true);
    });
  }

  it('checks the fixed-year epagomenal months and Hebrew leap-month membership', () => {
    for (const name of ['egyptian', 'zoroastrian']) {
      const forward = converters[name];
      if (!forward) throw new Error(`Unknown calendar ${name}`);
      expect(() => forward(1, 13, 6)).toThrow(RangeError);
      expect(forward(1, 13, 5.75)).toBe(forward(1, 13, 5) + 0.75);
      expect(forward(1, 13, 5) + 1).toBe(forward(2, 1, 1));
    }
    expect(() => hebrew.toJD({ year: 5785, month: 13, day: 1 })).toThrow(RangeError);
    expect(hebrew.fromJD(hebrew.toJD({ year: 5784, month: 13, day: 29 }))).toEqual({
      year: 5784,
      month: 13,
      day: 29,
    });
  });
});
