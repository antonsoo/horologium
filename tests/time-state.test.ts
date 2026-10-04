import { describe, expect, it } from 'vitest';
import { formatDateReadout } from '../src/app/controls.js';
import {
  MAX_JD_EXCLUSIVE,
  MIN_JD,
  parseDateEntry,
  permalinkHash,
  readPermalink,
  stepCivil,
} from '../src/app/time-state.js';
import { gregorianToJD, jdToGregorian } from '../src/lib/core/jd.js';

const now = gregorianToJD(2026, 10, 4) + 0.75;
describe('strict and bounded browser dates', () => {
  it.each(['', '0', '-1', '1.5', '2025tail', '1e3', '9007199254740993'])(
    'rejects year %s',
    (year) => {
      expect(parseDateEntry(year, 'CE', 1, '1').error).toBeDefined();
    },
  );
  it.each(['', '0', '-1', '1.5', '32'])('rejects day %s', (day) => {
    expect(parseDateEntry('2025', 'CE', 1, day).error).toBeDefined();
  });
  it('rejects impossible dates and out-of-range years without normalizing them', () => {
    for (const year of ['1900', '2025'])
      expect(parseDateEntry(year, 'CE', 2, '29').error).toBeDefined();
    expect(parseDateEntry('2024', 'CE', 4, '31').error).toBeDefined();
    expect(parseDateEntry('5001', 'CE', 1, '1').error).toBeDefined();
    expect(parseDateEntry('5002', 'BCE', 1, '1').error).toBeDefined();
    expect(parseDateEntry('2025', 'CE', 13, '1').error).toBeDefined();
  });
  it('accepts valid leap dates and both range boundaries at noon UTC', () => {
    expect(parseDateEntry('2000', 'CE', 2, '29').jd).toBe(gregorianToJD(2000, 2, 29) + 0.5);
    expect(parseDateEntry('1', 'BCE', 2, '29').jd).toBe(gregorianToJD(0, 2, 29) + 0.5);
    expect(parseDateEntry('5001', 'BCE', 1, '1').jd).toBe(MIN_JD + 0.5);
    expect(parseDateEntry('5000', 'CE', 12, '31').jd).toBe(MAX_JD_EXCLUSIVE - 0.5);
  });
});
describe('civil calendar stepping', () => {
  it.each([
    [2024, 1, 31, 'month', 1, 2024, 2, 29],
    [2025, 1, 31, 'month', 1, 2025, 2, 28],
    [2024, 3, 31, 'month', -1, 2024, 2, 29],
    [2024, 2, 29, 'year', 1, 2025, 2, 28],
    [2024, 2, 29, 'year', -1, 2023, 2, 28],
    [2024, 12, 31, 'month', 1, 2025, 1, 31],
    [0, 12, 31, 'day', 1, 1, 1, 1],
    [1, 1, 31, 'month', -1, 0, 12, 31],
    [0, 2, 29, 'year', -1, -1, 2, 28],
    [-1, 12, 31, 'month', 1, 0, 1, 31],
  ] as const)('%s-%s-%s + %s %s preserves 18:00 UTC', (y, m, d, unit, amount, ey, em, ed) => {
    expect(stepCivil(gregorianToJD(y, m, d) + 0.75, unit, amount)).toBe(
      gregorianToJD(ey, em, ed) + 0.75,
    );
  });
  it('refuses to move outside the browser range', () => {
    expect(stepCivil(MIN_JD, 'day', -1)).toBeNull();
    expect(stepCivil(MAX_JD_EXCLUSIVE - 0.25, 'day', 1)).toBeNull();
    expect(stepCivil(MIN_JD, 'year', -1)).toBeNull();
    expect(stepCivil(now, 'year', 1e20)).toBeNull();
    expect(stepCivil(Number.NaN, 'month', 1)).toBeNull();
  });
  it('a year scrub uses its original anchor, including a leap-day return', () => {
    const anchor = gregorianToJD(2024, 2, 29) + 0.5;
    expect(jdToGregorian(stepCivil(anchor, 'year', 10) ?? 0)).toEqual({
      year: 2034,
      month: 2,
      day: 28.5,
    });
    expect(jdToGregorian(stepCivil(anchor, 'year', 20) ?? 0)).toEqual({
      year: 2044,
      month: 2,
      day: 29.5,
    });
    expect(stepCivil(anchor, 'year', 0)).toBe(anchor);
  });
  it('the readout preserves whole minutes on ordinary minute boundaries', () => {
    expect(formatDateReadout(gregorianToJD(2026, 10, 4) + 8 / 1440).secondary).toContain(
      '00:08 UTC',
    );
    expect(formatDateReadout(gregorianToJD(0, 1, 1) + 0.5).primary).toBe('1 January 1 BCE');
  });
  it('displays every UTC minute correctly across the browser year range', () => {
    for (const y of [-5000, 0, 2000, 5000]) {
      const midnight = gregorianToJD(y, 1, 1);
      for (let minute = 0; minute < 1440; minute++) {
        const expected = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} UTC`;
        expect(
          formatDateReadout(midnight + minute / 1440).secondary,
          `year ${y}, minute ${minute}`,
        ).toContain(expected);
      }
    }
  });
});
describe('recoverable time links', () => {
  it.each([
    '#jd=%E0%A4%A',
    '#jd=2451545junk',
    '#jd=NaN',
    '#jd=Infinity',
    '#jd=1e308',
    '#jd=0xFF',
    '#jd=',
    '#jd=1&jd=2',
    '#live=1&jd=2451545',
    '#live=0',
    '#loc=Babylon',
    '#jd=2451545&loc=Unknown',
    '#live=1&loc=Rome&loc=Babylon',
  ])('rejects %s safely', (hash) => {
    expect(readPermalink(hash, now).kind).toBe('invalid');
  });
  it('guards the endpoints and excessive input size', () => {
    expect(readPermalink(`#jd=${MIN_JD - 1}`, now).kind).toBe('invalid');
    expect(readPermalink(`#jd=${MAX_JD_EXCLUSIVE}`, now).kind).toBe('invalid');
    expect(readPermalink(`#jd=${MIN_JD}`, now).kind).toBe('valid');
    expect(readPermalink(`#jd=${now}&x=${'a'.repeat(2048)}`, now).kind).toBe('invalid');
  });
  it('round-trips the complete instant and city name with one field decode', () => {
    const time = { jd: now + 0.000000123, live: false, locationName: "Chang'an (Xi'an)" };
    const link = readPermalink(permalinkHash(time), now);
    expect(link.kind === 'valid' && link.time).toEqual(time);
    expect(readPermalink('#jd=2451545&loc=Rome%26jd%3D1', now).kind).toBe('invalid');
  });
  it('live links retain their mode while empty links return to now', () => {
    const time = { jd: now - 1, live: true, locationName: 'Babylon' };
    const hash = permalinkHash(time);
    expect(hash).not.toContain('jd=');
    expect(readPermalink(hash, now)).toEqual({
      kind: 'valid',
      time: { ...time, jd: now },
      note: '',
    });
    expect(readPermalink('', now)).toEqual({
      kind: 'valid',
      time: { jd: now, live: true, locationName: 'Rome' },
      note: '',
    });
    expect(readPermalink('#main', now)).toEqual({ kind: 'anchor' });
  });
  it('private and legacy personal-location links explain their Rome fallback', () => {
    for (const hash of [
      permalinkHash({ jd: now, live: false, locationName: 'My location' }),
      `#jd=${now}&loc=My+location`,
    ]) {
      const link = readPermalink(hash, now);
      expect(link.kind === 'valid' && link.time.locationName).toBe('Rome');
      expect(link.kind === 'valid' && link.note).toContain('original tab');
    }
  });
});
