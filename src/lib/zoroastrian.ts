/**
 * The Zoroastrian (Yazdegerdi) religious calendar: a pure 365-day
 * "wandering" year with no leap day, the same 12x30+5 structure as the
 * Egyptian civil calendar (see `egyptian.ts`), epoch 16 June 632 CE
 * (Julian) -- the accession of Yazdegerd III, the last Sasanian emperor.
 * Structure per Reingold & Dershowitz, *Calendrical Calculations: The
 * Ultimate Edition* (Cambridge University Press, 2018).
 *
 * This is the traditional (Qadimi) reckoning: a fixed, unadjusted 365-day
 * year that drifts against the solar year by about 1 day every 4 years,
 * the same way the Egyptian civil year does. Other Zoroastrian communities
 * use the Shahanshahi or Fasli variants, which apply different periodic
 * corrections to stay aligned with the seasons; those are not implemented
 * here.
 *
 * Each of the 30 days within a month also has its own traditional name
 * (several of which repeat the 12 month names, since both cycles are
 * named after the same Zoroastrian divinities/qualities - e.g. day 1 and
 * the first month are both "Hormazd"). That per-day name list is not
 * rendered here: it is a genuinely obscure list to get exactly right from
 * memory, and getting it wrong would be worse than showing a plain day
 * number - see the project's ground rule against guessing at unverified
 * data.
 */

import { type JulianDay, julianToJD, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

export interface ZoroastrianDate {
  /** Year of the Yazdegerdi era, starting at 1. */
  year: number;
  /** 1-12 for the civil months; 13 for the 5 (Gatha) epagomenal days. */
  month: number;
  /** 1-30 for months 1-12; 1-5 when month is 13. */
  day: number;
}

export const ZOROASTRIAN_MONTH_NAMES: readonly string[] = [
  'Fravardin',
  'Ardibehesht',
  'Khordad',
  'Tir',
  'Amardad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
];

/** The 5 Gatha (epagomenal) days, named for the five Gathic hymns attributed to Zoroaster. */
export const GATHA_DAY_NAMES: readonly string[] = [
  'Ahunavaiti',
  'Ushtavaiti',
  'Spentamainyu',
  'Vohuxshathra',
  'Vahishtoishti',
];

/** Epoch: 16 June 632 CE (Julian), the accession of Yazdegerd III. */
export const ZOROASTRIAN_EPOCH_JD: JulianDay = julianToJD(632, 6, 16);

export function fromJD(jd: JulianDay): ZoroastrianDate {
  const daysSinceEpoch = Math.floor(jd - ZOROASTRIAN_EPOCH_JD);
  const yearIndex = Math.floor(daysSinceEpoch / 365);
  const dayOfYear = mod(daysSinceEpoch, 365);
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return { year: yearIndex + 1, month, day };
}

export function toJD(date: ZoroastrianDate): JulianDay {
  const daysSinceEpoch = (date.year - 1) * 365 + (date.month - 1) * 30 + (date.day - 1);
  return ZOROASTRIAN_EPOCH_JD + daysSinceEpoch;
}

export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const monthName =
    date.month === 13
      ? (GATHA_DAY_NAMES[date.day - 1] ?? 'Gatha')
      : (ZOROASTRIAN_MONTH_NAMES[date.month - 1] ?? '');
  const label =
    date.month === 13
      ? `${monthName} (Gatha day ${date.day}), YZ ${date.year}`
      : `${date.day} ${monthName}, YZ ${date.year}`;
  return {
    id: 'zoroastrian',
    name: 'Zoroastrian (Yazdegerdi) Calendar',
    native: label,
    transliteration: label,
    summary: label,
    method:
      'Traditional (Qadimi) reckoning: a fixed 365-day year (12 months of 30 days + 5 Gatha days), ' +
      'no leap day, epoch 16 June 632 CE Julian (accession of Yazdegerd III). Like the Egyptian civil ' +
      'calendar, this wanders against the solar year by about 1 day every 4 years; the Fasli and ' +
      'Shahanshahi variants (which apply corrections to stay seasonally aligned) are not implemented. ' +
      'Per-day names within the month are not shown (see source comment for why).',
    isReconstruction: false,
  };
}
