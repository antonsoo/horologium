/**
 * The Roman (Julian) civil calendar: Kalends/Nones/Ides day-naming, the AUC
 * year, the Latin planetary weekday, and Roman seasonal hours (horae /
 * vigiliae).
 *
 * Scope: this models the calendar *after* Julius Caesar's reform of 46/45
 * BCE (the "Julian" calendar proper), built on {@link julianToJD}/
 * {@link jdToJulian} from the core module. The pre-reform Republican
 * calendar (with its irregular intercalary month, the *Mercedonius*,
 * inserted at the discretion of the pontifices) is a materially different,
 * poorly-documented system and is out of scope here.
 *
 * Source for the Kalends/Nones/Ides reckoning and the bissextile leap-day
 * convention: standard classical-philology reference material (e.g. the
 * treatment in Bickerman, *Chronology of the Ancient World*, or any Latin
 * grammar's calendar appendix); this is settled, non-controversial material
 * with no single canonical formula to cite the way Meeus/Reingold-Dershowitz
 * give formulas, so it is implemented directly from the counting rule rather
 * than transcribed from a numbered algorithm.
 */

import { sunTimes } from './astronomy/sun-moon.js';
import {
  type CalendarDate,
  type JulianDay,
  isJulianLeapYear,
  jdToJulian,
  jdWeekday,
  julianToJD,
} from './core/jd.js';
import type { CalendarTablet } from './types.js';

// --- Month name tables ------------------------------------------------------

/** Plain English month names, reused by other Julian-calendar-based modules (e.g. Byzantine AM). */
export const JULIAN_MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Accusative month forms, used after "Kalendas"/"Nonas"/"Idus" (a.d./pridie
 * phrases). Post-Julian-reform naming: Iulias (not Quintiles), Augustas (not
 * Sextiles).
 */
const MONTH_ACCUSATIVE = [
  'Ianuarias',
  'Februarias',
  'Martias',
  'Apriles',
  'Maias',
  'Iunias',
  'Iulias',
  'Augustas',
  'Septembres',
  'Octobres',
  'Novembres',
  'Decembres',
] as const;

/** Ablative month forms, used for the named day itself ("Kalendis Ianuariis"). */
const MONTH_ABLATIVE = [
  'Ianuariis',
  'Februariis',
  'Martiis',
  'Aprilibus',
  'Maiis',
  'Iuniis',
  'Iuliis',
  'Augustis',
  'Septembribus',
  'Octobribus',
  'Novembribus',
  'Decembribus',
] as const;

/** Standard epigraphic abbreviations of the accusative month forms, for "a.d." lines. */
const MONTH_ABBREV = [
  'Ian.',
  'Feb.',
  'Mart.',
  'Apr.',
  'Mai.',
  'Iun.',
  'Iul.',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

// --- Roman numerals ---------------------------------------------------------

const NUMERAL_TABLE: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Standard subtractive-notation Roman numerals, range 1-3999. */
export function toRomanNumerals(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new Error(`toRomanNumerals: ${n} is outside the representable range 1-3999`);
  }
  let remaining = n;
  let result = '';
  for (const [value, symbol] of NUMERAL_TABLE) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Spelled-out Latin ordinals for "ante diem <ordinal> Kalendas/Nonas/Idus",
 * counts 3-19 (the longest span used is the run from the day after the Ides
 * of December to the day before the Kalends of January, which needs up to
 * "ante diem undevicesimum"). 1 is never used here (that's the named day
 * itself) and 2 is always "pridie", not an ordinal.
 *
 * 18 and 19 use the classical Latin subtractive forms (duodevicesimum,
 * undevicesimum -- literally "two/one from the twentieth"), which is how
 * Romans actually said these numbers, rather than the regular compound
 * "octavum decimum"/"nonum decimum".
 */
const ORDINAL_WORDS: Readonly<Record<number, string>> = {
  3: 'tertium',
  4: 'quartum',
  5: 'quintum',
  6: 'sextum',
  7: 'septimum',
  8: 'octavum',
  9: 'nonum',
  10: 'decimum',
  11: 'undecimum',
  12: 'duodecimum',
  13: 'tertium decimum',
  14: 'quartum decimum',
  15: 'quintum decimum',
  16: 'sextum decimum',
  17: 'septimum decimum',
  18: 'duodevicesimum',
  19: 'undevicesimum',
};

// --- Kalends / Nones / Ides day-naming --------------------------------------

export type RomanReferencePoint = 'kalends' | 'nones' | 'ides';

export interface RomanDate {
  /** Astronomical Julian-calendar year of the day itself. */
  year: number;
  /** Julian-calendar month (1-12) of the day itself. */
  month: number;
  /** Julian-calendar day-of-month of the day itself (integer; time-of-day is dropped). */
  day: number;
  /** AUC year (Varronian epoch, 753 BCE = AUC 1). */
  aucYear: number;
  /** Which named point of the month this day is reckoned relative to. */
  referencePoint: RomanReferencePoint;
  /** Julian-calendar month (1-12) the reference point itself falls in (may be next month, for Kalends). */
  referenceMonth: number;
  /** Astronomical year the reference point falls in (may be next year, for a late-December Kalends count). */
  referenceYear: number;
  /**
   * Inclusive Roman day count: 1 = the reference day itself (Kalendis/
   * Nonis/Idibus), 2 = pridie, >=3 = "ante diem <romanCount>".
   */
  romanCount: number;
  /** True only for the intercalated leap day itself (the second "a.d. VI Kal. Mart."). */
  isBissextile: boolean;
}

/** Ides fall on the 15th of March, May, July, October; the 13th of every other month. */
function idesDay(month: number): number {
  return month === 3 || month === 5 || month === 7 || month === 10 ? 15 : 13;
}

/** Nones are always 8 days before the Ides by inclusive Roman counting: the 7th or the 5th. */
function nonesDay(month: number): number {
  return idesDay(month) - 8;
}

/** The civil (always-28-day-February) Julian month length, i.e. ignoring the bissextile insertion. */
const CIVIL_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Roman (Julian) calendar date for a JD.
 *
 * The tricky part is February in a leap year: the Romans did not append a
 * 29th day at the end of the month (that is a modern bookkeeping
 * convenience, which is what {@link jdToJulian} gives us). They inserted an
 * extra day *before* the traditional a.d. VI Kalendas Martias (our Feb 24),
 * doubling it, and every day from that point through the Kalends of March
 * keeps counting as if nothing after that insertion point had shifted. So:
 * days 1-23 of a leap-year February count exactly as in a common year; day
 * 24 is the first "a.d. VI Kal. Mart."; day 25 is the doubled
 * (bissextile) repeat of it; and days 26-29 count as if they were the
 * common-year days 25-28.
 */
export function fromJD(jd: JulianDay): RomanDate {
  const cal: CalendarDate = jdToJulian(jd);
  const year = cal.year;
  const month = cal.month;
  const day = Math.floor(cal.day);
  const aucYear = year + 753; // Varronian epoch: 753 BCE = astronomical year -752, and -752 + 753 = 1 = AUC 1.

  const nones = nonesDay(month);
  const ides = idesDay(month);

  if (day === 1) {
    return {
      year,
      month,
      day,
      aucYear,
      referencePoint: 'kalends',
      referenceMonth: month,
      referenceYear: year,
      romanCount: 1,
      isBissextile: false,
    };
  }
  if (day < nones) {
    return {
      year,
      month,
      day,
      aucYear,
      referencePoint: 'nones',
      referenceMonth: month,
      referenceYear: year,
      romanCount: nones - day + 1,
      isBissextile: false,
    };
  }
  if (day === nones) {
    return {
      year,
      month,
      day,
      aucYear,
      referencePoint: 'nones',
      referenceMonth: month,
      referenceYear: year,
      romanCount: 1,
      isBissextile: false,
    };
  }
  if (day < ides) {
    return {
      year,
      month,
      day,
      aucYear,
      referencePoint: 'ides',
      referenceMonth: month,
      referenceYear: year,
      romanCount: ides - day + 1,
      isBissextile: false,
    };
  }
  if (day === ides) {
    return {
      year,
      month,
      day,
      aucYear,
      referencePoint: 'ides',
      referenceMonth: month,
      referenceYear: year,
      romanCount: 1,
      isBissextile: false,
    };
  }

  // Counting toward the Kalends of the next month (and possibly next year).
  const referenceMonth = month === 12 ? 1 : month + 1;
  const referenceYear = month === 12 ? year + 1 : year;

  let effectiveDay = day;
  let isBissextile = false;
  if (month === 2 && isJulianLeapYear(year)) {
    if (day === 24) {
      // first occurrence of a.d. VI Kal. Mart. -- unchanged
    } else if (day === 25) {
      isBissextile = true;
      effectiveDay = 24; // the doubled day repeats the same count as day 24
    } else if (day >= 26) {
      effectiveDay = day - 1; // days after the insertion count as if one earlier
    }
  }

  const civilLength = CIVIL_MONTH_LENGTHS[month - 1];
  if (civilLength === undefined) throw new Error(`unreachable: month ${month} out of range 1-12`);
  const romanCount = civilLength - effectiveDay + 2;
  return {
    year,
    month,
    day,
    aucYear,
    referencePoint: 'kalends',
    referenceMonth,
    referenceYear,
    romanCount,
    isBissextile,
  };
}

/** Inverse of {@link fromJD}: the underlying Julian-calendar date determines the JD exactly. */
export function toJD(date: RomanDate): JulianDay {
  return julianToJD(date.year, date.month, date.day);
}

function refWordAccusative(point: RomanReferencePoint): string {
  return point === 'kalends' ? 'Kalendas' : point === 'nones' ? 'Nonas' : 'Idus';
}

function refWordAblative(point: RomanReferencePoint): string {
  return point === 'kalends' ? 'Kalendis' : point === 'nones' ? 'Nonis' : 'Idibus';
}

function refWordAbbrev(point: RomanReferencePoint): string {
  return point === 'kalends' ? 'Kal.' : point === 'nones' ? 'Non.' : 'Id.';
}

/** Abbreviated Latin, e.g. "a.d. VIII Kal. Oct.", "Kal. Ian.", "prid. Kal. Mart.". */
function formatAbbrev(date: RomanDate): string {
  const monthAbbrev = MONTH_ABBREV[date.referenceMonth - 1];
  if (date.isBissextile) return `a.d. bis VI ${refWordAbbrev(date.referencePoint)} ${monthAbbrev}`;
  if (date.romanCount === 1) return `${refWordAbbrev(date.referencePoint)} ${monthAbbrev}`;
  if (date.romanCount === 2) return `prid. ${refWordAbbrev(date.referencePoint)} ${monthAbbrev}`;
  return `a.d. ${toRomanNumerals(date.romanCount)} ${refWordAbbrev(date.referencePoint)} ${monthAbbrev}`;
}

/** Full spelled-out Latin, e.g. "ante diem octavum Kalendas Octobres", "Idibus Martiis". */
function formatFull(date: RomanDate): string {
  const monthAcc = MONTH_ACCUSATIVE[date.referenceMonth - 1];
  if (date.isBissextile) return `ante diem bis sextum Kalendas ${monthAcc}`;
  if (date.romanCount === 1)
    return `${refWordAblative(date.referencePoint)} ${MONTH_ABLATIVE[date.referenceMonth - 1]}`;
  if (date.romanCount === 2) return `pridie ${refWordAccusative(date.referencePoint)} ${monthAcc}`;
  const word = ORDINAL_WORDS[date.romanCount];
  if (word === undefined)
    throw new Error(`no ordinal word tabulated for Roman count ${date.romanCount}`);
  return `ante diem ${word} ${refWordAccusative(date.referencePoint)} ${monthAcc}`;
}

function englishReferenceName(point: RomanReferencePoint): string {
  return point === 'kalends' ? 'Kalends' : point === 'nones' ? 'Nones' : 'Ides';
}

function formatSummary(date: RomanDate): string {
  const monthName = JULIAN_MONTH_NAMES_EN[date.referenceMonth - 1];
  const refName = englishReferenceName(date.referencePoint);
  if (date.isBissextile)
    return `The intercalated leap day (doubled "sixth day before the Kalends of March"), AUC ${date.aucYear}`;
  if (date.romanCount === 1) return `The ${refName} of ${monthName}, AUC ${date.aucYear}`;
  if (date.romanCount === 2)
    return `The day before the ${refName} of ${monthName}, AUC ${date.aucYear}`;
  return `${date.romanCount} days before the ${refName} of ${monthName}, AUC ${date.aucYear}`;
}

/** `CalendarTablet` for the Roman (Julian) civil calendar date at `jd`. */
export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const native = formatAbbrev(date);
  const transliteration = formatFull(date);
  return {
    id: 'roman',
    name: 'Roman (Julian) Calendar',
    native,
    transliteration,
    summary: formatSummary(date),
    method:
      'Post-45 BCE Julian civil calendar. Days are named by inclusive counting back from the ' +
      'next Kalends, Nones, or Ides (the pre-reform Republican calendar with its irregular ' +
      'intercalary Mercedonius is out of scope). AUC year = astronomical year + 753 (Varronian ' +
      'epoch, 753 BCE = AUC 1). The leap day is modeled as the historical doubled ' +
      '"a.d. VI Kalendas Martias", not a bolted-on 29th of February.',
    isReconstruction: false,
  };
}

// --- AUC ---------------------------------------------------------------
// (aucYear is carried directly on RomanDate; see the derivation comment in fromJD.)

// --- Latin planetary weekday -------------------------------------------

/**
 * The later 7-day planetary week (dies Solis .. dies Saturni), attested from
 * roughly the 1st-3rd centuries CE onward. This is emphatically NOT what a
 * Roman of, say, Caesar's generation (44 BCE) used day to day -- they used
 * the 8-day nundinal cycle (the market week, lettered A-H, tied to a
 * fixed point in the Republican calendar), a different system entirely and
 * out of scope for this module. Presenting the planetary week as if it were
 * universal Roman practice would misrepresent the 1st-century-BCE date this
 * library's tests anchor on (the Ides of March 44 BCE), so it is exported
 * here purely as "the 7-day week Romans eventually settled on", not as a
 * period-accurate daily reckoning.
 */
export const LATIN_WEEKDAYS = [
  'dies Solis',
  'dies Lunae',
  'dies Martis',
  'dies Mercurii',
  'dies Iovis',
  'dies Veneris',
  'dies Saturni',
] as const;

/** Latin name of the (later, planetary) weekday for `jd`; see {@link LATIN_WEEKDAYS}'s caveat. */
export function latinWeekday(jd: JulianDay): string {
  const idx = jdWeekday(jd);
  const name = LATIN_WEEKDAYS[idx];
  if (name === undefined) throw new Error(`unreachable: jdWeekday returned out-of-range ${idx}`);
  return name;
}

// --- Roman seasonal hours ------------------------------------------------

/** Rome, the default location for Roman seasonal hours. */
export const ROME = { latDeg: 41.9028, lonDeg: 12.4964 };

/**
 * Ancient-site coordinates useful elsewhere in this project (e.g. the web
 * app's location picker and Roman-hour calculation). Coordinates are the
 * modern geographic location of each site (Chang'an = modern Xi'an,
 * Tenochtitlan = modern Mexico City, Babylon = near modern Hillah, Iraq).
 */
export const ANCIENT_CITIES: Array<{ name: string; latDeg: number; lonDeg: number }> = [
  { name: 'Rome', ...ROME },
  { name: 'Athens', latDeg: 37.9838, lonDeg: 23.7275 },
  { name: 'Alexandria', latDeg: 31.2001, lonDeg: 29.9187 },
  { name: 'Babylon', latDeg: 32.5355, lonDeg: 44.4275 },
  { name: 'Jerusalem', latDeg: 31.7683, lonDeg: 35.2137 },
  { name: "Chang'an (Xi'an)", latDeg: 34.3416, lonDeg: 108.9398 },
  { name: 'Tikal', latDeg: 17.222, lonDeg: -89.6237 },
  { name: 'Tenochtitlan (Mexico City)', latDeg: 19.4326, lonDeg: -99.1332 },
];

const HORA_NAMES = [
  'prima',
  'secunda',
  'tertia',
  'quarta',
  'quinta',
  'sexta',
  'septima',
  'octava',
  'nona',
  'decima',
  'undecima',
  'duodecima',
] as const;

const VIGILIA_NAMES = ['prima', 'secunda', 'tertia', 'quarta'] as const;

export interface RomanHour {
  /** True for one of the 12 daylight horae, false for one of the 4 night vigiliae. */
  isDaytime: boolean;
  /** 1-12 for daytime horae, 1-4 for night vigiliae. */
  index: number;
  /** Latin label, e.g. "hora sexta" or "vigilia tertia". */
  label: string;
  /** True if the location has no sunrise/sunset on this day (polar day/night); the result then degenerates to "hora prima". */
  circumpolar: boolean;
}

/**
 * Which Roman seasonal hour (of 12 daylight horae) or night watch (of 4
 * vigiliae) `jd` falls in, at (`latDeg`, `lonDeg`). Daylight is
 * {@link sunTimes}'s sunrise..sunset divided into 12 equal parts; night is
 * the sunset..next-sunrise span divided into 4 equal parts. Inherits
 * {@link sunTimes}'s accuracy caveats: no Delta-T correction and the civil
 * day is treated as a constant 86400 SI seconds, so treat results as
 * approximate over historical timescales.
 */
export function romanHour(jd: JulianDay, latDeg: number, lonDeg: number): RomanHour {
  const times = sunTimes(jd, latDeg, lonDeg);
  if (times.circumpolar) {
    return { isDaytime: true, index: 1, label: 'hora prima', circumpolar: true };
  }

  if (jd >= times.sunriseJD && jd < times.sunsetJD) {
    const frac = (jd - times.sunriseJD) / (times.sunsetJD - times.sunriseJD);
    const index = Math.min(12, Math.floor(frac * 12) + 1);
    const name = HORA_NAMES[index - 1] ?? HORA_NAMES[11];
    return { isDaytime: true, index, label: `hora ${name}`, circumpolar: false };
  }

  const adjacent =
    jd < times.sunriseJD ? sunTimes(jd - 1, latDeg, lonDeg) : sunTimes(jd + 1, latDeg, lonDeg);
  if (adjacent.circumpolar) {
    return { isDaytime: false, index: 1, label: 'vigilia prima', circumpolar: true };
  }
  const nightStart = jd < times.sunriseJD ? adjacent.sunsetJD : times.sunsetJD;
  const nightEnd = jd < times.sunriseJD ? times.sunriseJD : adjacent.sunriseJD;
  const frac = (jd - nightStart) / (nightEnd - nightStart);
  const index = Math.min(4, Math.max(1, Math.floor(frac * 4) + 1));
  const name = VIGILIA_NAMES[index - 1] ?? VIGILIA_NAMES[3];
  return { isDaytime: false, index, label: `vigilia ${name}`, circumpolar: false };
}
