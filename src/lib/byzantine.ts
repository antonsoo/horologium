/**
 * The Byzantine Anno Mundi calendar and the Indiction cycle.
 *
 * Both are annotations on top of the ordinary Julian civil calendar
 * (see {@link jdToJulian}/{@link julianToJD} in `./core/jd.js`): the month
 * and day are exactly the Julian ones, but the *year* is counted
 * differently, and the year rolls over on 1 September rather than 1
 * January.
 *
 * Epoch derivations (worked out here rather than asserted, per this
 * project's sourcing rule):
 *
 * - Byzantine AM epoch is 1 September 5509 BCE (Julian). In astronomical
 *   year numbering, 5509 BCE = -(5509 - 1) = -5508. A date on or after 1
 *   September in Julian year Y belongs to Byzantine year (Y + 5509); one
 *   cannot use the same offset for Jan-Aug, since the AM year has already
 *   ticked over the *previous* September, so those months get (Y + 5508).
 *   Check: the epoch itself, Julian year -5508 month 9, gives
 *   -5508 + 5509 = AM 1. Correct by construction.
 *
 * - The indiction is a 15-year Roman/Byzantine tax-assessment cycle,
 *   re-epoched (by later Byzantine convention) to 1 September 312 CE =
 *   Indiction 1, also rolling over on 1 September. Counting September-years
 *   from that epoch (September year 312 = indiction-cycle-year 1, September
 *   year 313 = cycle-year 2, ..., wrapping every 15), the formula is
 *   `indiction = amod(septemberYear - 312 + 1, 15)`. Check: September year
 *   312 gives amod(1, 15) = 1, landing exactly on 312-313 CE as required.
 */

import { type JulianDay, amod, jdToJulian, julianToJD } from './core/jd.js';
import { JULIAN_MONTH_NAMES_EN } from './roman.js';
import type { CalendarTablet } from './types.js';

/**
 * Both the AM year and the indiction change on 1 September (Julian), not 1
 * January. This folds a Julian (year, month) into the "September year" that
 * both cycles are actually counted from: unchanged for Sep-Dec, one less
 * for Jan-Aug (still counted as belonging to the year that began the
 * previous September).
 */
function septemberYear(julianYear: number, julianMonth: number): number {
  return julianMonth >= 9 ? julianYear : julianYear - 1;
}

export interface ByzantineDate {
  /** Byzantine Anno Mundi year. */
  amYear: number;
  /** Position (1-15) in the 15-year indiction cycle. */
  indiction: number;
  /** The underlying Julian-calendar year of the day itself. */
  julianYear: number;
  /** The underlying Julian-calendar month (1-12) of the day itself. */
  julianMonth: number;
  /** The underlying Julian-calendar day-of-month of the day itself. */
  julianDay: number;
}

/** Byzantine AM year + Indiction for a JD; see the module doc comment for the epoch derivations. */
export function fromJD(jd: JulianDay): ByzantineDate {
  const cal = jdToJulian(jd);
  const julianYear = cal.year;
  const julianMonth = cal.month;
  const julianDay = Math.floor(cal.day);
  const sy = septemberYear(julianYear, julianMonth);
  return {
    amYear: sy + 5509,
    indiction: amod(sy - 312 + 1, 15),
    julianYear,
    julianMonth,
    julianDay,
  };
}

/** Inverse of {@link fromJD}: the underlying Julian-calendar date determines the JD exactly. */
export function toJD(date: ByzantineDate): JulianDay {
  return julianToJD(date.julianYear, date.julianMonth, date.julianDay);
}

/** `CalendarTablet` for the Byzantine AM date (with Indiction) at `jd`. */
export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const monthName = JULIAN_MONTH_NAMES_EN[date.julianMonth - 1];
  const transliteration = `Anno Mundi ${date.amYear}, Indiction ${date.indiction}`;
  return {
    id: 'byzantine',
    name: 'Byzantine Anno Mundi Calendar',
    native: transliteration,
    transliteration,
    summary: `${monthName} ${date.julianDay} (Julian), Byzantine Anno Mundi ${date.amYear}, ${date.indiction}${ordinalSuffix(date.indiction)} Indiction`,
    method:
      'Julian civil calendar month/day, year counted from a 1 September 5509 BCE epoch (AM), ' +
      'with a parallel 15-year Indiction tax cycle epoched to 1 September 312 CE = Indiction 1. ' +
      'Both roll over on 1 September, not 1 January. Byzantine AM year is conventionally rendered ' +
      'with Greek numerals in scholarly editions; this library keeps it as a plain Arabic-numeral ' +
      'year for simplicity rather than reaching for that convention. Documented historical dating ' +
      'system (Orthodox liturgical use), not a modern reconstruction.',
    isReconstruction: false,
  };
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
