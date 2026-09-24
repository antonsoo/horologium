import { describe, expect, it } from 'vitest';
import { gregorianToJD, julianToJD } from '../src/lib/core/jd.js';
import * as zoroastrian from '../src/lib/zoroastrian.js';

describe('Zoroastrian calendar', () => {
  it('epoch (16 June 632 CE Julian) is 1 Fravardin, YZ 1', () => {
    const jd = julianToJD(632, 6, 16);
    const d = zoroastrian.fromJD(jd);
    expect(d).toEqual({ year: 1, month: 1, day: 1 });
  });

  it('round-trips toJD(fromJD(jd)) across ~5000 years', () => {
    const start = gregorianToJD(-3000, 1, 1);
    for (let i = 0; i < 250; i++) {
      const jd = Math.floor(start + i * 7.3) + 0.5; // day-granular JDs end in .5
      const d = zoroastrian.fromJD(jd);
      expect(zoroastrian.toJD(d)).toBe(jd);
    }
  });

  it('has 12 months of 30 days plus 5 Gatha days = 365 total', () => {
    expect(zoroastrian.ZOROASTRIAN_MONTH_NAMES).toHaveLength(12);
    expect(zoroastrian.GATHA_DAY_NAMES).toHaveLength(5);
    const yearEnd =
      zoroastrian.toJD({ year: 2, month: 1, day: 1 }) -
      zoroastrian.toJD({ year: 1, month: 1, day: 1 });
    expect(yearEnd).toBe(365);
  });

  it('describe() labels the calendar as non-reconstruction (it is attested arithmetic)', () => {
    expect(zoroastrian.describe(gregorianToJD(2026, 9, 24)).isReconstruction).toBe(false);
  });
});
