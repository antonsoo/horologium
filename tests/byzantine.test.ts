import { describe, expect, it } from 'vitest';
import { describe as describeByzantine, fromJD, toJD } from '../src/lib/byzantine.js';
import { julianToJD } from '../src/lib/core/jd.js';

describe('byzantine calendar round-trip', () => {
  it('recovers the JD for a spread of ~200 dates across +/-5000 years', () => {
    let checked = 0;
    for (let year = -5000; year <= 5000; year += 50) {
      const month = ((year % 12) + 12) % 12 || 12;
      const jd = julianToJD(year, month, 10);
      const date = fromJD(jd);
      const back = toJD(date);
      expect(back).toBeCloseTo(jd, 6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('byzantine calendar hand-checked dates', () => {
  it('the epoch (1 September 5509 BCE Julian) is AM 1, Indiction epoch', () => {
    // 5509 BCE in astronomical year numbering is -(5509-1) = -5508.
    const jd = julianToJD(-5508, 9, 1);
    const date = fromJD(jd);
    expect(date.amYear).toBe(1);
  });

  it('1 September 312 CE (Julian) is Indiction 1', () => {
    const jd = julianToJD(312, 9, 1);
    const date = fromJD(jd);
    expect(date.indiction).toBe(1);
  });

  it('indiction wraps every 15 years and never leaves 1-15', () => {
    for (let year = 300; year <= 400; year++) {
      const jd = julianToJD(year, 9, 1);
      const date = fromJD(jd);
      expect(date.indiction).toBeGreaterThanOrEqual(1);
      expect(date.indiction).toBeLessThanOrEqual(15);
    }
    // One full cycle later than the epoch should land back on indiction 1.
    expect(fromJD(julianToJD(312 + 15, 9, 1)).indiction).toBe(1);
  });

  it('the AM year rolls over on 1 September, not 1 January', () => {
    const beforeRollover = fromJD(julianToJD(2000, 8, 31));
    const afterRollover = fromJD(julianToJD(2000, 9, 1));
    expect(afterRollover.amYear).toBe(beforeRollover.amYear + 1);
  });

  it('describe() reports "Anno Mundi <year>, Indiction <n>"', () => {
    const jd = julianToJD(2000, 9, 1);
    const tablet = describeByzantine(jd);
    const date = fromJD(jd);
    expect(tablet.transliteration).toBe(`Anno Mundi ${date.amYear}, Indiction ${date.indiction}`);
    expect(tablet.isReconstruction).toBe(false);
  });
});
