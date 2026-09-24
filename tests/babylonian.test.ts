import { describe, expect, it } from 'vitest';
import { BABYLONIAN_MONTH_NAMES, fromJD, SELEUCID_EPOCH_JD } from '../src/lib/babylonian.js';
import { gregorianToJD, jdToJulian, julianToJD } from '../src/lib/core/jd.js';

describe('Babylonian (Seleucid Era) calendar', () => {
  it('epoch is 3 April 311 BCE (Julian)', () => {
    expect(jdToJulian(SELEUCID_EPOCH_JD)).toEqual({ year: -310, month: 4, day: 3 });
  });

  it('the epoch date itself falls in SE 1, month 1 (Nisannu)', () => {
    const d = fromJD(SELEUCID_EPOCH_JD);
    expect(d.seYear).toBe(1);
    expect(d.month).toBe(1);
    expect(d.isIntercalary).toBe(false);
  });

  it('has the 12 standard Akkadian month names', () => {
    expect(BABYLONIAN_MONTH_NAMES).toHaveLength(12);
    expect(BABYLONIAN_MONTH_NAMES[0]).toBe('Nisannu');
    expect(BABYLONIAN_MONTH_NAMES[11]).toBe('Addaru');
  });

  it('month/day stay in a sane range across a wide historical spread', () => {
    // Regression test for a real bug this project hit and fixed: a fixed
    // "25 March" pivot for finding the vernal equinox undershoots the true
    // equinox once the Julian calendar's drift pushes it past that date
    // (which happens by ~311 BCE already - see the nisannu1() comment in
    // babylonian.ts), silently skipping a whole year. Sweeps a wide date
    // range so a regression here would be caught again.
    const start = gregorianToJD(-3000, 1, 1);
    let bad = 0;
    for (let i = 0; i < 3000; i++) {
      const jd = start + i * 141.3;
      const d = fromJD(jd);
      if (d.day < 1 || d.day > 31 || d.month < 1 || d.month > 12) bad++;
    }
    expect(bad).toBe(0);
  });

  it('SE year increments by roughly 1 per Julian calendar year', () => {
    const a = fromJD(julianToJD(100, 6, 1));
    const b = fromJD(julianToJD(101, 6, 1));
    expect(b.seYear).toBe(a.seYear + 1);
  });
});
