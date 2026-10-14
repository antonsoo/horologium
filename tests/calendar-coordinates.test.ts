import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gregorianToJD } from '../src/lib/core/jd.js';
import * as egyptian from '../src/lib/egyptian.js';
import * as maya from '../src/lib/maya.js';

const reference: {
  mayaDates: { date: [number, number, number]; longCount: number[]; lord: string }[];
} = JSON.parse(
  readFileSync(new URL('../studies/calendar-coordinates/reference.json', import.meta.url), 'utf8'),
);

describe('calendar coordinates against published anchors', () => {
  it.each(reference.mayaDates)('Maya $date has the published $lord', (entry) => {
    const jd = gregorianToJD(...entry.date);
    const [baktun, katun, tun, winal, kin] = entry.longCount;
    expect(maya.longCountFromJD(jd)).toEqual({ baktun, katun, tun, winal, kin });
    expect(maya.lordOfNightFromJD(jd)).toBe(entry.lord);
    expect(maya.fromJD(jd).lordOfNight).toBe(entry.lord);
    expect(maya.describe(jd).summary).toContain(`Lord of the Night ${entry.lord}`);
  });

  it('keeps the G9 period-ending anchor with either correlation and backward cycles', () => {
    for (const correlation of [584283, 584285]) {
      const epoch = correlation - 0.5;
      for (const days of [-9, 0, 9, 360, 7200, 144000, 1872000]) {
        expect(maya.lordOfNightFromJD(epoch + days, correlation)).toBe('G9');
        expect(maya.fromJD(epoch + days, correlation).lordOfNight).toBe('G9');
        expect(maya.lordOfNightFromJD(epoch + days + 1, correlation)).toBe('G1');
        expect(maya.lordOfNightFromJD(epoch + days - 1, correlation)).toBe('G8');
      }
    }
  });

  it.each([
    [3, 13, 'III Akhet, day 73 of the season'],
    [8, 13, 'IV Peret, day 103 of the season'],
    [12, 30, 'IV Shemu, day 120 of the season'],
  ] as const)('Egyptian month %i day %i reports %s', (month, day, expected) => {
    const jd = egyptian.toJD({ year: 2773, month, day });
    expect(egyptian.describe(jd).summary).toMatch(new RegExp(`^${expected} — `));
  });
});
