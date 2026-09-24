/**
 * Babylonian (Seleucid Era) calendar: an astronomical reconstruction of a
 * lunisolar calendar known mostly from cuneiform administrative and
 * astronomical tablets.
 *
 * Sources (specific, not generic citations):
 *  - Seleucid Era epoch: 1 Nisannu, SE 1 = 3 April 311 BCE (Julian) -
 *    Seleucus I's Babylonian-reckoning "return to Babylon" date; see the
 *    Wikipedia "Seleucid era" article's "Babylonian reckoning" section.
 *  - The 19-year intercalation cycle: Richard A. Parker & Waldo H.
 *    Dubberstein, *Babylonian Chronology 626 B.C.-A.D. 75* (Brown
 *    University Press), summarized at
 *    dec25th.info/The%20Babylonian%20Calendar.html: from 503 BCE onward,
 *    regularized Babylonian practice intercalated a 13th month in 7 years
 *    out of every 19, keeping Nisannu on/after the vernal equinox; 6 of
 *    those 7 years added a second Addaru (Addaru II, at year-end), and 1
 *    added a second Ululu (Ululu II, mid-year) instead.
 *  - Month names (Akkadian, transliterated): Nisannu, Ayyaru, Simanu,
 *    Du'uzu, Abu, Ululu, Tashritu, Arahsamnu, Kislimu, Tebetu, Shabatu,
 *    Addaru.
 *
 * This module does NOT try to reproduce *which specific* cycle-years used
 * Ululu II: the source above states the pattern (6 Addaru-II years, 1
 * Ululu-II year per 19-year cycle) but locking that to a specific cycle
 * *phase* relative to the Seleucid Era's own year numbering is something
 * this project could not verify with confidence in the time available
 * (an early version of this module guessed SE year 1 = cycle position 1,
 * which produced a leap pattern contradicted by this module's own
 * astronomy at some dates thousands of years out - see the git history
 * for that bug). Instead, whether a year needs a 13th month is determined
 * directly and self-consistently from this project's own new-moon/
 * equinox root-finding (does the gap from this year's Nisannu 1 to next
 * year's exceed 12 synodic months?), and every such year intercalates
 * Addaru II. The real, well-attested Ululu-II exception is not modeled;
 * treat any specific reconstructed date as illustrative, not archivally
 * attested, same as `chinese.ts` and `greek.ts`.
 *
 * Real Babylonian months began at the first visible evening crescent,
 * roughly a day (occasionally two) after the astronomical new moon this
 * module actually roots-finds on (the same Meeus 1998 Sun/Moon formulas
 * used throughout this project) - so a specific reconstructed date here
 * can be off by a day or two from what a cuneiform tablet would attest.
 * Cuneiform logograms for the month names are not rendered: this project
 * had no reliable way to verify exact Unicode Cuneiform (U+12000 block)
 * codepoints for them in the time available, and a wrong glyph is worse
 * than none (the same reasoning `egyptian.ts` applies to hieroglyphs).
 */

import { findSolarLongitudeCrossing, nextNewMoon } from './astronomy/sun-moon.js';
import { type JulianDay, jdToJulian, julianToJD } from './core/jd.js';
import type { CalendarTablet } from './types.js';

const BABYLON_LONGITUDE_DEG = 44.4275;
const BABYLON_UTC_OFFSET_DAYS = BABYLON_LONGITUDE_DEG / 360;
const SYNODIC_MONTH = 29.530588861;

function localDayNumber(jd: JulianDay): number {
  return Math.floor(jd + BABYLON_UTC_OFFSET_DAYS + 0.5);
}

export const BABYLONIAN_MONTH_NAMES: readonly string[] = [
  'Nisannu',
  'Ayyaru',
  'Simanu',
  "Du'uzu",
  'Abu',
  'Ululu',
  'Tashritu',
  'Arahsamnu',
  'Kislimu',
  'Tebetu',
  'Shabatu',
  'Addaru',
];

const ADDARU_INDEX = 11; // 0-based

/** 1 Nisannu, SE 1 = 3 April 311 BCE (Julian). */
export const SELEUCID_EPOCH_JD: JulianDay = julianToJD(-310, 4, 3);

/**
 * 1 Nisannu of `seYear`: the first new moon at/after the vernal equinox
 * nearest that year, per Parker & Dubberstein's finding that regularized
 * intercalation kept Nisannu starting on/after the equinox.
 */
function nisannu1(seYear: number): JulianDay {
  const approxJulianYear = jdToJulian(SELEUCID_EPOCH_JD).year + (seYear - 1);
  // The Julian calendar's slightly-too-long year (365.25d vs the ~365.2422d
  // tropical year) makes the equinox drift to *later* Julian-calendar dates
  // the further back in time we go (about 1 day later per ~125 years) -
  // empirically around 25-26 March by 311 BCE, and further still for the
  // more ancient dates this project covers. May 1 stays safely after the
  // true equinox across this project's full +/-5000 year range, so the
  // backward search below always lands on the *current* year's equinox
  // rather than accidentally undershooting into the previous year's.
  const pivot = julianToJD(approxJulianYear, 5, 1);
  const equinox = findSolarLongitudeCrossing(pivot, 0, -1);
  return nextNewMoon(equinox);
}

export interface BabylonianDate {
  seYear: number;
  /** 1-12; see `isIntercalary` for the 13th-month case. */
  month: number;
  /** True for an intercalated second Addaru (this module's simplified single intercalation point; see module docs). */
  isIntercalary: boolean;
  day: number;
}

export function fromJD(jd: JulianDay): BabylonianDate {
  const approxYear = Math.round((jd - SELEUCID_EPOCH_JD) / 365.2425) + 1;
  let seYear = approxYear;
  let thisYearStart = nisannu1(seYear);
  while (thisYearStart > jd) {
    seYear -= 1;
    thisYearStart = nisannu1(seYear);
  }
  let nextYearStart = nisannu1(seYear + 1);
  while (nextYearStart <= jd) {
    seYear += 1;
    thisYearStart = nextYearStart;
    nextYearStart = nisannu1(seYear + 1);
  }

  // Determined astronomically (see module docs), not from an assumed cycle phase.
  const monthCount = Math.round((nextYearStart - thisYearStart) / SYNODIC_MONTH);

  const monthStarts: JulianDay[] = [thisYearStart];
  for (let i = 1; i < monthCount; i++) {
    monthStarts.push(nextNewMoon((monthStarts[i - 1] as JulianDay) + 1));
  }

  const localDay = localDayNumber(jd);
  let idx = 0;
  for (let i = 0; i < monthStarts.length; i++) {
    if (localDayNumber(monthStarts[i] as JulianDay) <= localDay) idx = i;
  }
  const day = localDay - localDayNumber(monthStarts[idx] as JulianDay) + 1;

  const month = idx <= ADDARU_INDEX ? idx + 1 : ADDARU_INDEX + 1;
  const isIntercalary = idx > ADDARU_INDEX;

  return { seYear, month, isIntercalary, day };
}

export function describe(jd: JulianDay): CalendarTablet {
  const d = fromJD(jd);
  const baseName = BABYLONIAN_MONTH_NAMES[d.month - 1] ?? '';
  const monthLabel = d.isIntercalary ? `${baseName} II` : baseName;
  const label = `${d.day} ${monthLabel}, SE ${d.seYear}`;
  return {
    id: 'babylonian',
    name: 'Babylonian (Seleucid Era) Calendar',
    native: label,
    transliteration: label,
    summary: label,
    method:
      'Reconstruction: Seleucid Era year from epoch 1 Nisannu SE 1 = 3 April 311 BCE (Julian). ' +
      'Nisannu 1 is the first new moon at/after the vernal equinox each year; other months follow ' +
      'new-moon to new-moon. Whether a year gets a 13th month (intercalary Addaru II) is determined ' +
      'from this project’s own new-moon/equinox arithmetic, not an assumed phase within the ' +
      'historically-attested 19-year cycle (Parker & Dubberstein) - so the real, well-attested ' +
      'exception where a second Ululu was intercalated mid-year instead is not modeled. New moons ' +
      'and the equinox are root-found on this project’s own Sun/Moon formulas (Meeus 1998) - see ' +
      'docs/CALENDARS.md.',
    isReconstruction: true,
  };
}
