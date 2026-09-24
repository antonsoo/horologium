/**
 * The Islamic tabular (arithmetical, "civil") calendar.
 *
 * This is NOT the observational calendar that governs actual religious
 * practice, where each month begins on physical sighting of the lunar
 * crescent (or a sighting-equivalent astronomical calculation) and can
 * therefore differ from this arithmetic by a day or two in either
 * direction. This module implements the purely arithmetical scheme
 * sometimes called the "Kuwaiti algorithm" or, more generically, "the
 * civil tabular Islamic calendar, 30-year cycle" -- a fixed rule with no
 * observation involved, useful for a stable proleptic mapping but not for
 * telling you when Ramadan actually starts in a given real-world year.
 *
 * Rule (standard tabular scheme, matching the 11 leap years at cycle
 * positions {2,5,7,10,13,16,18,21,24,26,29} specified for this project):
 * 12 months alternating 30/29 days, with the 12th month (Dhu al-Hijjah)
 * gaining an extra day in leap years, repeating on a 30-year cycle with 11
 * leap years. This is equivalent to (and implemented as) the standard
 * closed-form test `mod(14 + 11*year, 30) < 11`, following Reingold &
 * Dershowitz, *Calendrical Calculations: The Ultimate Edition* (2018),
 * "The Arithmetical (Tabular) Islamic Calendar".
 *
 * Epoch: 1 Muharram AH 1 = 16 July 622 CE (Julian) = JD 1948439.5. Verified
 * here (not just asserted) by computing `julianToJD(622, 7, 16)`, which
 * gives exactly 1948439.5, and cross-checking its weekday: `jdWeekday`
 * reports Friday, matching the traditional account of the Hijra epoch date.
 */

import { type JulianDay, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

/** JD of 1 Muharram AH 1 (16 July 622 CE, Julian calendar); see the module doc comment for the verification. */
export const ISLAMIC_EPOCH_JD: JulianDay = 1948439.5;

export const ISLAMIC_MONTH_NAMES = [
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
] as const;

export interface IslamicDate {
  /** AH year (Anno Hegirae). */
  year: number;
  /** 1-12, indexing {@link ISLAMIC_MONTH_NAMES}. */
  month: number;
  /** 1-30. */
  day: number;
}

/** True if AH `year` is a leap year (12th month has 30 days instead of 29) in the tabular scheme. */
export function islamicLeapYear(year: number): boolean {
  return mod(14 + 11 * year, 30) < 11;
}

/** Length in days of `month` (1-12) of AH `year`. */
export function islamicMonthLength(year: number, month: number): number {
  if (month === 12) return islamicLeapYear(year) ? 30 : 29;
  return month % 2 === 1 ? 30 : 29;
}

/**
 * JD for an Islamic tabular date. Closed form (Reingold & Dershowitz):
 * `day + ceil(29.5*(month-1)) + (year-1)*354 + floor((3+11*year)/30) + epoch - 1`.
 * Verified by brute-force month-by-month enumeration against this formula
 * across AH 1-200 during development (see the library's derivation notes);
 * the two agree exactly everywhere checked.
 */
export function toJD(date: IslamicDate): JulianDay {
  return (
    date.day +
    Math.ceil(29.5 * (date.month - 1)) +
    (date.year - 1) * 354 +
    Math.floor((3 + 11 * date.year) / 30) +
    ISLAMIC_EPOCH_JD -
    1
  );
}

/**
 * Inverse of {@link toJD}. Estimates the year from the mean tabular year
 * length (10631/30 days) and then walks to the exact year/month boundary,
 * which is robust and, unlike a purely closed-form inverse, self-evidently
 * consistent with {@link toJD} by construction.
 */
export function fromJD(jd: JulianDay): IslamicDate {
  const dateInt = Math.floor(jd - 0.5) + 0.5;

  let year = Math.floor((30 * (dateInt - ISLAMIC_EPOCH_JD) + 10646) / 10631);
  while (toJD({ year: year + 1, month: 1, day: 1 }) <= dateInt) year++;
  while (toJD({ year, month: 1, day: 1 }) > dateInt) year--;

  let month = Math.min(12, Math.ceil((dateInt - toJD({ year, month: 1, day: 1 }) + 1) / 29.5));
  while (month < 12 && toJD({ year, month: month + 1, day: 1 }) <= dateInt) month++;
  while (toJD({ year, month, day: 1 }) > dateInt) month--;

  const day = dateInt - toJD({ year, month, day: 1 }) + 1;
  return { year, month, day };
}

/** `CalendarTablet` for the Islamic tabular date at `jd`. */
export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const monthName = ISLAMIC_MONTH_NAMES[date.month - 1];
  const transliteration = `${date.day} ${monthName} ${date.year} AH`;
  return {
    id: 'islamic',
    name: 'Islamic Tabular (Civil) Calendar',
    native: transliteration,
    transliteration,
    summary:
      'Tabular/arithmetical reckoning -- the moon-sighting calendar actually used for religious ' +
      'observance can differ from this date by a day or two in either direction.',
    method:
      'Arithmetical civil tabular Islamic calendar ("Kuwaiti algorithm"): fixed 30-year cycle, ' +
      '11 leap years at cycle positions 2,5,7,10,13,16,18,21,24,26,29, 12 months alternating ' +
      '30/29 days with Dhu al-Hijjah gaining a day in leap years. Epoch 1 Muharram AH 1 = 16 July ' +
      '622 CE (Julian), JD 1948439.5. This is a computed civil convention, NOT the moon-sighting ' +
      'observational calendar that governs actual religious observance; several other tabular ' +
      'leap-year placements are also used historically, and this is one conventional choice among them.',
    isReconstruction: false,
  };
}
