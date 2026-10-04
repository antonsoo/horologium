/** Bounded browser inputs. The library's arithmetic remains usable independently. */
import { gregorianToJD, isGregorianLeapYear, jdToGregorian } from '../lib/core/jd.js';
import { ANCIENT_CITIES } from '../lib/roman.js';

export const MIN_YEAR = -5000;
export const MAX_YEAR = 5000;
export const MIN_JD = gregorianToJD(MIN_YEAR, 1, 1);
export const MAX_JD_EXCLUSIVE = gregorianToJD(MAX_YEAR + 1, 1, 1);
export const DATE_LIMIT_TEXT = 'Choose a date from 5001 BCE through 5000 CE.';
export const PRIVATE_LOCATION = 'My location';

export interface ClockTime {
  jd: number;
  live: boolean;
  locationName: string;
}

export function supportedJD(jd: number): boolean {
  return Number.isFinite(jd) && jd >= MIN_JD && jd < MAX_JD_EXCLUSIVE;
}

export function monthLength(year: number, month: number): number {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export type DateEntry = { jd: number; error?: never } | { error: string; jd?: never };

export function parseDateEntry(
  yearText: string,
  era: string,
  month: number,
  dayText: string,
): DateEntry {
  if (!/^\d+$/.test(yearText) || !/^\d+$/.test(dayText)) {
    return { error: 'Enter a whole, positive year and day.' };
  }
  const yearNumber = Number(yearText);
  const day = Number(dayText);
  if (!Number.isSafeInteger(yearNumber) || yearNumber < 1 || (era !== 'CE' && era !== 'BCE')) {
    return { error: 'Use a year of 1 or greater and choose CE or BCE; there is no year zero.' };
  }
  const year = era === 'BCE' ? 1 - yearNumber : yearNumber;
  if (year < MIN_YEAR || year > MAX_YEAR) return { error: DATE_LIMIT_TEXT };
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthLength(year, month)
  ) {
    return { error: 'That day does not exist in the selected month and year.' };
  }
  return { jd: gregorianToJD(year, month, day) + 0.5 };
}

export type CivilUnit = 'day' | 'month' | 'year';

/** Preserve UTC time, clamping the day when the destination month is shorter. */
export function stepCivil(jd: number, unit: CivilUnit, amount: number): number | null {
  if (!supportedJD(jd) || !Number.isSafeInteger(amount)) return null;
  if (unit === 'day') return supportedJD(jd + amount) ? jd + amount : null;
  const g = jdToGregorian(jd);
  const monthIndex = g.year * 12 + g.month - 1 + amount * (unit === 'year' ? 12 : 1);
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const day = Math.floor(g.day);
  const time = jd - gregorianToJD(g.year, g.month, day);
  const next = gregorianToJD(year, month, Math.min(day, monthLength(year, month))) + time;
  return supportedJD(next) ? next : null;
}

export type Permalink =
  | { kind: 'anchor' }
  | { kind: 'invalid'; error: string }
  | { kind: 'valid'; time: ClockTime; note: string };

const LINK_ERROR =
  'This time link is invalid. The clock kept its last valid date. Choose a date or return to now.';
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function readPermalink(hash: string, nowJD: number): Permalink {
  if (hash === '#main') return { kind: 'anchor' };
  if (hash === '' || hash === '#') {
    return { kind: 'valid', time: { jd: nowJD, live: true, locationName: 'Rome' }, note: '' };
  }
  if (hash.length > 2048) return { kind: 'invalid', error: LINK_ERROR };
  // URLSearchParams decodes each field once and handles malformed percent sequences safely.
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (['jd', 'live', 'loc'].some((key) => params.getAll(key).length > 1)) {
    return { kind: 'invalid', error: LINK_ERROR };
  }
  const live = params.get('live');
  const jdText = params.get('jd');
  if ((live !== null && live !== '1') || (live === '1' && jdText !== null)) {
    return { kind: 'invalid', error: LINK_ERROR };
  }
  if (live !== '1' && (jdText === null || !DECIMAL.test(jdText))) {
    return { kind: 'invalid', error: LINK_ERROR };
  }
  const jd = live === '1' ? nowJD : Number(jdText);
  if (!supportedJD(jd)) return { kind: 'invalid', error: `${LINK_ERROR} ${DATE_LIMIT_TEXT}` };
  const loc = params.get('loc') ?? 'Rome';
  const privateLocation = loc === 'private' || loc === PRIVATE_LOCATION;
  if (!privateLocation && !ANCIENT_CITIES.some((city) => city.name === loc)) {
    return { kind: 'invalid', error: LINK_ERROR };
  }
  return {
    kind: 'valid',
    time: { jd, live: live === '1', locationName: privateLocation ? 'Rome' : loc },
    note: privateLocation
      ? 'Personal coordinates stay in the original tab. This link uses Rome.'
      : '',
  };
}

export function permalinkHash(time: ClockTime): string {
  const params = new URLSearchParams();
  if (time.live) params.set('live', '1');
  else params.set('jd', String(time.jd)); // retain the full instant, including its fractional day
  params.set('loc', time.locationName === PRIVATE_LOCATION ? 'private' : time.locationName);
  return `#${params.toString()}`;
}
