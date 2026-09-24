/**
 * Ancient Greek time-reckoning: Olympiad numbering, and an astronomical
 * reconstruction of the Athenian (Attic) lunisolar calendar.
 *
 * Month names and the "first new moon after the summer solstice" year-
 * start rule are attested (see en.wikipedia.org/wiki/Attic_calendar, which
 * also notes real Athenian practice did not follow a fixed rule for
 * *which* years got a 13th month or reliably repeat the same month when
 * they did -- Poseideon is simply the most commonly attested choice).
 * Because real Athenian intercalation was decreed year to year rather than
 * computed, this module is an explicit **reconstruction**: it always uses
 * the first new moon after the solstice for month 1, and always
 * intercalates a second Poseideon when a year needs a 13th month. Treat
 * specific ancient dates as illustrative, not archivally attested.
 *
 * New moons and solstices are root-found on this project's own low-
 * precision Sun/Moon longitude formulas (Meeus 1998); day boundaries use a
 * fixed mean-time offset for Athens's longitude (23.7275 deg E), the same
 * simplification `chinese.ts` uses for China Standard Time, rather than
 * modeling the sunset-to-sunset civil day Greek practice actually used.
 */

import { findSolarLongitudeCrossing, nextNewMoon } from './astronomy/sun-moon.js';
import { type JulianDay, jdToJulian, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

const ATHENS_LONGITUDE_DEG = 23.7275;
const ATHENS_UTC_OFFSET_DAYS = ATHENS_LONGITUDE_DEG / 360;

function localDayNumber(jd: JulianDay): number {
  return Math.floor(jd + ATHENS_UTC_OFFSET_DAYS + 0.5);
}

export const ATTIC_MONTH_NAMES: readonly string[] = [
  'Hekatombaion',
  'Metageitnion',
  'Boedromion',
  'Pyanepsion',
  'Maimakterion',
  'Poseideon',
  'Gamelion',
  'Anthesterion',
  'Elaphebolion',
  'Mounychion',
  'Thargelion',
  'Skirophorion',
];

/** Polytonic Greek forms, same order as {@link ATTIC_MONTH_NAMES}. */
export const ATTIC_MONTH_NAMES_GREEK: readonly string[] = [
  'Ἑκατομβαιών',
  'Μεταγειτνιών',
  'Βοηδρομιών',
  'Πυανεψιών',
  'Μαιμακτηριών',
  'Ποσειδεών',
  'Γαμηλιών',
  'Ἀνθεστηριών',
  'Ἐλαφηβολιών',
  'Μουνυχιών',
  'Θαργηλιών',
  'Σκιροφοριών',
];

const POSEIDEON_INDEX = 5; // 0-based index of Poseideon in ATTIC_MONTH_NAMES

export interface AtticDate {
  /** Astronomical (Julian-calendar) year in which this Attic year begins. */
  yearStartsIn: number;
  /** 1-12. */
  month: number;
  /** True for the intercalated second Poseideon. */
  isIntercalary: boolean;
  day: number;
}

interface YearStructure {
  monthStarts: JulianDay[]; // length 12 or 13
  yearStartsIn: number;
  cycleStartSolsticeJD: JulianDay;
  cycleEndJD: JulianDay;
  nextSolsticeJD: JulianDay;
}

function computeYearStructure(jd: JulianDay): YearStructure {
  const ws0 = findSolarLongitudeCrossing(jd, 90, -1);
  const ws1 = findSolarLongitudeCrossing(ws0 + 10, 90, 1);
  const yearStart0 = nextNewMoon(ws0);
  const yearStart1 = nextNewMoon(ws1);

  const newMoons: JulianDay[] = [yearStart0];
  while ((newMoons[newMoons.length - 1] as JulianDay) < yearStart1 - 1) {
    newMoons.push(nextNewMoon((newMoons[newMoons.length - 1] as JulianDay) + 1));
  }
  // Drop the trailing terminator (next year's month 1), same convention as chinese.ts.
  const monthStarts = newMoons.slice(0, -1);

  return {
    monthStarts,
    yearStartsIn: jdToJulian(yearStart0).year,
    cycleStartSolsticeJD: ws0,
    cycleEndJD: yearStart1,
    nextSolsticeJD: ws1,
  };
}

export function atticFromJD(jd: JulianDay): AtticDate {
  let structure = computeYearStructure(jd);
  const localDay = localDayNumber(jd);
  // `jd` can land in the gap between a solstice and *that* solstice's own
  // first new moon (the year hasn't started yet by this reckoning) while
  // still being after the *previous* solstice - i.e. it actually belongs
  // to the previous Attic year's last month. Mirror image of the
  // `cycleEndJD` check below; see the equivalent comment in chinese.ts.
  if (localDay < localDayNumber(structure.monthStarts[0] as JulianDay)) {
    structure = computeYearStructure(structure.cycleStartSolsticeJD - 10);
  } else if (localDay >= localDayNumber(structure.cycleEndJD)) {
    structure = computeYearStructure(structure.nextSolsticeJD + 1);
  }

  const { monthStarts, yearStartsIn } = structure;
  let idx = 0;
  for (let i = 0; i < monthStarts.length; i++) {
    if (localDayNumber(monthStarts[i] as JulianDay) <= localDay) idx = i;
  }
  const day = localDay - localDayNumber(monthStarts[idx] as JulianDay) + 1;

  const isLeapYear = monthStarts.length === 13;
  let month: number;
  let isIntercalary = false;
  if (!isLeapYear || idx <= POSEIDEON_INDEX) {
    month = idx + 1;
  } else if (idx === POSEIDEON_INDEX + 1) {
    month = POSEIDEON_INDEX + 1; // repeated Poseideon
    isIntercalary = true;
  } else {
    month = idx; // shifted back by the one intercalary slot
  }

  return { yearStartsIn, month, isIntercalary, day };
}

export interface OlympiadDate {
  /** The Olympiad number, 1 = 776 BCE. */
  number: number;
  /** Year within the Olympiad, 1-4. */
  year: number;
}

/** 776 BCE (traditional epoch of the first Olympiad) = astronomical year -775. */
const FIRST_OLYMPIAD_YEAR = -775;

export function olympiadFromJD(jd: JulianDay): OlympiadDate {
  const { yearStartsIn } = computeYearStructure(jd);
  const yearsSince = yearStartsIn - FIRST_OLYMPIAD_YEAR;
  return { number: Math.floor(yearsSince / 4) + 1, year: mod(yearsSince, 4) + 1 };
}

export function describe(jd: JulianDay): CalendarTablet {
  const attic = atticFromJD(jd);
  const ol = olympiadFromJD(jd);
  const monthNameEn = attic.isIntercalary
    ? `${ATTIC_MONTH_NAMES[POSEIDEON_INDEX]} II`
    : (ATTIC_MONTH_NAMES[attic.month - 1] ?? '');
  const monthNameGr = attic.isIntercalary
    ? `${ATTIC_MONTH_NAMES_GREEK[POSEIDEON_INDEX]} Βʹ`
    : (ATTIC_MONTH_NAMES_GREEK[attic.month - 1] ?? '');
  const transliteration = `${attic.day} ${monthNameEn}, Ol. ${ol.number}.${ol.year}`;
  return {
    id: 'greek',
    name: 'Greek (Attic) Calendar',
    native: `${attic.day} ${monthNameGr}, Ὀλ. ${ol.number}.${ol.year}`,
    transliteration,
    summary: `${transliteration} (year begins ${attic.yearStartsIn <= 0 ? `${1 - attic.yearStartsIn} BCE` : `${attic.yearStartsIn} CE`})`,
    method:
      'Reconstruction: the Attic year starts at the first new moon after the summer solstice; ' +
      'months run new-moon to new-moon; a year needing a 13th lunation always intercalates a ' +
      'second Poseideon (the most commonly attested choice, though real Athenian practice ' +
      'intercalated other months too and did not follow a fixed rule). Olympiad numbering: ' +
      '776 BCE = Ol. 1.1, incrementing every 4 years from the same year-start. New moons and ' +
      'the solstice are root-found on this project’s own Sun/Moon formulas (Meeus 1998).',
    isReconstruction: true,
  };
}
