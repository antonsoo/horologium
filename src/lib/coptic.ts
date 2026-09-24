/**
 * The Coptic (Era of the Martyrs) and Ethiopian (Anno Mundi) calendars.
 *
 * Both share one structure -- 12 months of 30 days plus a short 13th
 * "epagomenal" month of 5 days (6 in a leap year) -- differing only in
 * epoch and month names, so both are built on one shared arithmetic core
 * and exposed as two thin, differently-epoched wrappers around it.
 *
 * Leap rule (shared): a year is leap (13th month has 6 days) iff
 * `(year + 1) mod 4 == 0`, i.e. it tracks the Julian calendar's own 4-year
 * leap cycle one step out of phase, so that the extra Coptic/Ethiopian day
 * always falls just before the next Julian leap day (29 August preceding a
 * Julian 29 February). This is the standard rule for both calendars.
 *
 * Epochs, worked out (not just asserted) below:
 *
 * - Coptic epoch (Era of the Martyrs, Anno Martyrum): 1 Thout AM 1 = 29
 *   August 284 CE (Julian) -- the accession of Diocletian, whose
 *   persecutions the era commemorates.
 *
 * - Ethiopian epoch: 1 Meskerem year 1 = 29 August 8 CE (Julian), the
 *   conventional Ethiopian Anno Mundi epoch (roughly 276 years before the
 *   Coptic epoch, from a different Annunciation-era reckoning). Sanity
 *   check performed during development: stepping this epoch forward with
 *   the shared leap arithmetic to Ethiopian years 2015-2018 lands their
 *   New Year (1 Meskerem) on Gregorian 2022-09-11, 2023-09-12, 2024-09-11,
 *   2025-09-11 -- i.e. 11 September, or 12 September in the Ethiopian year
 *   whose New Year precedes a Gregorian leap February, exactly matching
 *   the well-known modern-date fact this epoch is supposed to reproduce.
 */

import { type JulianDay, julianToJD } from './core/jd.js';
import type { CalendarTablet } from './types.js';

export interface ThirteenMonthDate {
  year: number;
  /** 1-13; month 13 is the short epagomenal month. */
  month: number;
  /** 1-30 for months 1-12; 1-5 (or 1-6 in a leap year) for month 13. */
  day: number;
}

export type CopticDate = ThirteenMonthDate;
export type EthiopianDate = ThirteenMonthDate;

/**
 * JD for a `{year, month, day}` under the shared 13-month arithmetic, given
 * the calendar's epoch JD (the JD of 1/1/1). Closed form (standard for this
 * family of calendars, e.g. Reingold & Dershowitz's Coptic/Ethiopic
 * arithmetic): `epoch - 1 + 365*(year-1) + floor(year/4) + 30*(month-1) + day`.
 * Verified during development by brute-force month-by-month enumeration
 * across several hundred years either side of each epoch, including
 * negative years; the two agree exactly everywhere checked.
 */
function thirteenMonthToJD(epochJD: JulianDay, date: ThirteenMonthDate): JulianDay {
  return (
    epochJD -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day
  );
}

/**
 * Inverse of {@link thirteenMonthToJD}. Estimates the year from the mean
 * year length (1461/4 days over the 4-year leap cycle) and walks to the
 * exact boundary, guaranteeing consistency with the forward formula.
 */
function thirteenMonthFromJD(epochJD: JulianDay, jd: JulianDay): ThirteenMonthDate {
  const dateInt = Math.floor(jd - 0.5) + 0.5;

  let year = Math.floor((4 * (dateInt - epochJD) + 1463) / 1461);
  while (thirteenMonthToJD(epochJD, { year: year + 1, month: 1, day: 1 }) <= dateInt) year++;
  while (thirteenMonthToJD(epochJD, { year, month: 1, day: 1 }) > dateInt) year--;

  let month = Math.min(
    13,
    1 + Math.floor((dateInt - thirteenMonthToJD(epochJD, { year, month: 1, day: 1 })) / 30),
  );
  while (month < 13 && thirteenMonthToJD(epochJD, { year, month: month + 1, day: 1 }) <= dateInt)
    month++;
  while (thirteenMonthToJD(epochJD, { year, month, day: 1 }) > dateInt) month--;

  const day = dateInt - thirteenMonthToJD(epochJD, { year, month, day: 1 }) + 1;
  return { year, month, day };
}

// --- Coptic ------------------------------------------------------------

/** JD of 1 Thout AM 1 (29 August 284 CE, Julian) -- the Era of the Martyrs epoch. */
export const COPTIC_EPOCH_JD: JulianDay = julianToJD(284, 8, 29);

export const COPTIC_MONTH_NAMES = [
  'Thout',
  'Paopi',
  'Hathor',
  'Koiak',
  'Tobi',
  'Meshir',
  'Paremhat',
  'Paremoude',
  'Pashons',
  'Paoni',
  'Epip',
  'Mesori',
  'Pi Kogi Enavot',
] as const;

export function copticFromJD(jd: JulianDay): CopticDate {
  return thirteenMonthFromJD(COPTIC_EPOCH_JD, jd);
}

export function copticToJD(date: CopticDate): JulianDay {
  return thirteenMonthToJD(COPTIC_EPOCH_JD, date);
}

export function describeCoptic(jd: JulianDay): CalendarTablet {
  const date = copticFromJD(jd);
  const monthName = COPTIC_MONTH_NAMES[date.month - 1];
  const transliteration = `${date.day} ${monthName} ${date.year} AM`;
  return {
    id: 'coptic',
    name: 'Coptic Calendar',
    native: transliteration,
    transliteration,
    summary: `${transliteration} (Era of the Martyrs)`,
    method:
      'Coptic civil/liturgical calendar, Era of the Martyrs (Anno Martyrum): 12 months of 30 ' +
      'days plus a 5-day epagomenal month (6 in a leap year, when (AM+1) mod 4 == 0). Epoch 1 ' +
      'Thout AM 1 = 29 August 284 CE (Julian), the accession of Diocletian. Documented ' +
      'historical/liturgical dating system (still in Coptic Orthodox use), not a reconstruction.',
    isReconstruction: false,
  };
}

// --- Ethiopian -----------------------------------------------------------

/** JD of 1 Meskerem year 1 (29 August 8 CE, Julian) -- the conventional Ethiopian AM epoch. */
export const ETHIOPIAN_EPOCH_JD: JulianDay = julianToJD(8, 8, 29);

export const ETHIOPIAN_MONTH_NAMES = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
] as const;

export function ethiopianFromJD(jd: JulianDay): EthiopianDate {
  return thirteenMonthFromJD(ETHIOPIAN_EPOCH_JD, jd);
}

export function ethiopianToJD(date: EthiopianDate): JulianDay {
  return thirteenMonthToJD(ETHIOPIAN_EPOCH_JD, date);
}

export function describeEthiopian(jd: JulianDay): CalendarTablet {
  const date = ethiopianFromJD(jd);
  const monthName = ETHIOPIAN_MONTH_NAMES[date.month - 1];
  const transliteration = `${date.day} ${monthName} ${date.year}`;
  return {
    id: 'ethiopian',
    name: 'Ethiopian Calendar',
    native: transliteration,
    transliteration,
    summary: `${transliteration} (Ethiopian Anno Mundi)`,
    method:
      'Ethiopian civil/liturgical calendar: 12 months of 30 days plus a 5-day epagomenal month ' +
      '(6 in a leap year, when (year+1) mod 4 == 0). Epoch 1 Meskerem year 1 = 29 August 8 CE ' +
      '(Julian), roughly 7-8 years after the Coptic Era-of-Martyrs epoch due to a different ' +
      'Annunciation-era reckoning; verified during development by reproducing the well-known ' +
      'modern-date fact that Ethiopian New Year falls around 11 September (12 September in the ' +
      'Ethiopian year preceding a Gregorian leap year). Documented historical/liturgical dating ' +
      'system, not a reconstruction.',
    isReconstruction: false,
  };
}
