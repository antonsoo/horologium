import { describe, expect, it } from 'vitest';
import { gregorianToJD, julianToJD } from '../src/lib/core/jd.js';
import {
  EGYPTIAN_EPOCH_JD,
  describe as describeEgyptian,
  fromJD,
  seasonForMonth,
  sothicCyclePosition,
  toJD,
} from '../src/lib/egyptian.js';

describe('Egyptian calendar: Era of Nabonassar epoch', () => {
  it('matches the proleptic Julian date 26 February 747 BCE (astronomical year -746)', () => {
    expect(EGYPTIAN_EPOCH_JD).toBe(julianToJD(-746, 2, 26));
  });

  it('is JDN 1448638 under the noon-referenced convention Ptolemy cites (this library is midnight-referenced)', () => {
    expect(EGYPTIAN_EPOCH_JD + 0.5).toBe(1448638);
  });

  it('1 Thoth, Year 1 is the epoch itself', () => {
    expect(fromJD(EGYPTIAN_EPOCH_JD)).toEqual({ year: 1, month: 1, day: 1 });
    expect(toJD({ year: 1, month: 1, day: 1 })).toBe(EGYPTIAN_EPOCH_JD);
  });
});

describe('Egyptian calendar: structure', () => {
  it('has 12 months of 30 days plus 5 epagomenal days per 365-day year, with no leap day', () => {
    const yearStart = toJD({ year: 10, month: 1, day: 1 });
    const nextYearStart = toJD({ year: 11, month: 1, day: 1 });
    expect(nextYearStart - yearStart).toBe(365);
  });

  it('places the epagomenal days as month 13, days 1-5, immediately after Mesore', () => {
    const lastMesoreDay = toJD({ year: 3, month: 12, day: 30 });
    const firstEpagomenal = fromJD(lastMesoreDay + 1);
    expect(firstEpagomenal).toEqual({ year: 3, month: 13, day: 1 });
    const fifthEpagomenal = fromJD(lastMesoreDay + 5);
    expect(fifthEpagomenal).toEqual({ year: 3, month: 13, day: 5 });
    const nextYear = fromJD(lastMesoreDay + 6);
    expect(nextYear).toEqual({ year: 4, month: 1, day: 1 });
  });

  it('assigns Akhet/Peret/Shemu to months 1-12 in blocks of 4, and no season to the epagomenal days', () => {
    expect(seasonForMonth(1)?.name).toBe('Akhet');
    expect(seasonForMonth(4)?.name).toBe('Akhet');
    expect(seasonForMonth(5)?.name).toBe('Peret');
    expect(seasonForMonth(8)?.name).toBe('Peret');
    expect(seasonForMonth(9)?.name).toBe('Shemu');
    expect(seasonForMonth(12)?.name).toBe('Shemu');
    expect(seasonForMonth(13)).toBeNull();
  });

  it('omits the hieroglyph field rather than guessing', () => {
    expect(seasonForMonth(1)?.hieroglyph).toBeUndefined();
  });
});

describe('Egyptian calendar: Sothic cycle self-consistency', () => {
  it('aligns at the Censorinus anchor (139 CE) and one cycle earlier (1322 BCE, astronomical year -1321)', () => {
    const at139 = sothicCyclePosition(julianToJD(139, 1, 1));
    expect(at139.yearsIntoCycle).toBe(0);
    expect(at139.cycleAnchorCE).toBe(139);

    const at1322BCE = sothicCyclePosition(julianToJD(-1321, 1, 1));
    expect(at1322BCE.yearsIntoCycle).toBe(0);
  });

  it('the arithmetic anchor before 139 CE is 139 - 1460 = -1321 (1322 BCE)', () => {
    expect(139 - 1460).toBe(-1321);
  });
});

describe('Egyptian calendar: round trip', () => {
  it('toJD(fromJD(jd)) === jd across ~200 whole-day JDs spanning ~5000 years either side', () => {
    const start = gregorianToJD(-3000, 1, 1);
    const end = gregorianToJD(7000, 1, 1);
    const count = 200;
    for (let i = 0; i < count; i++) {
      const raw = start + ((end - start) * i) / (count - 1);
      const jd = Math.floor(raw) + 0.5;
      const date = fromJD(jd);
      expect(toJD(date)).toBe(jd);
    }
  });
});

describe('Egyptian calendar: describe()', () => {
  it('produces a plausible transliteration and a non-reconstruction tablet', () => {
    const jd = gregorianToJD(2024, 1, 1);
    const tablet = describeEgyptian(jd);
    expect(tablet.isReconstruction).toBe(false);
    expect(tablet.summary).toMatch(/year \d+ of Nabonassar/);
  });
});
