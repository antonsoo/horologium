/**
 * Hebrew (rabbinic/Jewish) calendar: exact molad (mean lunar conjunction)
 * arithmetic, chained through the 19-year Metonic leap cycle, with the four
 * traditional Rosh Hashanah postponement rules (dehiyyot).
 *
 * Algorithms follow Edward M. Reingold & Nachum Dershowitz, *Calendrical
 * Calculations: The Ultimate Edition* (Cambridge University Press, 2018),
 * the Hebrew calendar chapter. The underlying rules (molad interval, epoch
 * molad "BaHaRaD", the 19-year cycle, and the four dehiyyot) are the fixed
 * rabbinic arithmetic codified by Maimonides (Mishneh Torah, Hilchot Kiddush
 * HaChodesh, 12th century CE) and used unchanged for the calendar ever
 * since -- this is attested historical arithmetic, not a modern
 * reconstruction, hence `isReconstruction: false` throughout this module.
 *
 * Year numbering matches the calendar's own convention: the labeled year
 * increments at 1 Tishrei, but months are numbered from Nisan = 1 (the
 * Torah's "first month"), so a given labeled year's months run in the
 * chronological order Tishrei(7), Cheshvan(8), Kislev(9), Tevet(10),
 * Shevat(11), Adar/Adar I(12), [Adar II(13) if leap], Nisan(1), ...,
 * Elul(6).
 */

import { type JulianDay, jdWeekday, julianToJD, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

export interface HebrewDate {
  /** Labeled year, incrementing at Tishrei (year 1 = the traditional creation year). */
  year: number;
  /** 1 (Nisan) .. 12 or 13; see {@link monthName} for which "Adar" 12/13 means. */
  month: number;
  /** 1-30. */
  day: number;
}

/** Fixed-length months, Nisan(1) through Elul(6)/Tishrei(7) numbering. Index 0 = month 1. */
export const HEBREW_MONTH_NAMES_COMMON: readonly string[] = [
  'Nisan',
  'Iyar',
  'Sivan',
  'Tammuz',
  'Av',
  'Elul',
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  'Shevat',
  'Adar',
];

/** As {@link HEBREW_MONTH_NAMES_COMMON}, but for leap years: month 12 is Adar I, 13 is Adar II. */
export const HEBREW_MONTH_NAMES_LEAP: readonly string[] = [
  'Nisan',
  'Iyar',
  'Sivan',
  'Tammuz',
  'Av',
  'Elul',
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  'Shevat',
  'Adar I',
  'Adar II',
];

/** Hebrew-script equivalents of {@link HEBREW_MONTH_NAMES_COMMON}, same index order. */
export const HEBREW_MONTH_NAMES_COMMON_HE: readonly string[] = [
  'ניסן',
  'אייר',
  'סיון',
  'תמוז',
  'אב',
  'אלול',
  'תשרי',
  'חשוון',
  'כסלו',
  'טבת',
  'שבט',
  'אדר',
];

/** Hebrew-script equivalents of {@link HEBREW_MONTH_NAMES_LEAP}, same index order. */
export const HEBREW_MONTH_NAMES_LEAP_HE: readonly string[] = [
  'ניסן',
  'אייר',
  'סיון',
  'תמוז',
  'אב',
  'אלול',
  'תשרי',
  'חשוון',
  'כסלו',
  'טבת',
  'שבט',
  'אדר א׳',
  'אדר ב׳',
];

/** Molad instant: the mean lunar conjunction that determines a Tishrei's date. */
export interface Molad {
  /** JD (day granularity, i.e. ending .5) of the Hebrew calendar day the molad falls in. */
  day: JulianDay;
  /** Hour within that day, 0-23 (the Hebrew day begins at the previous evening). */
  hour: number;
  /** Parts (chalakim) within the hour, 0-1079; 1 hour = 1080 parts. */
  part: number;
  /** Day of week of `day`, 0 = Sunday .. 6 = Saturday. */
  weekday: number;
}

/** 1 hour = 1080 parts (chalakim); the traditional Hebrew calendar's time unit. */
const PARTS_PER_HOUR = 1080;
/** 1 day = 24 hours = 25920 parts. */
const PARTS_PER_DAY = 24 * PARTS_PER_HOUR;

/**
 * The molad interval: exactly 29 days, 12 hours, 793 parts (~29.530594
 * days), the traditional mean synodic month used for Hebrew calendar
 * arithmetic (slightly longer than the true modern mean synodic month of
 * ~29.530589 days -- the small difference is why the rabbinic calendar
 * slowly drifts relative to the astronomical mean moon over millennia).
 */
const MOLAD_INTERVAL_PARTS = 29 * PARTS_PER_DAY + 12 * PARTS_PER_HOUR + 793; // 765433

/**
 * BaHaRaD: the epoch molad of Tishrei, year 1 -- traditionally "2 days, 5
 * hours, 204 parts" after the start of the Hebrew calendar epoch, i.e. 5
 * hours and 204 parts after the start of 1 Tishrei year 1 itself (day 2 of
 * the creation week, a Monday). In parts-after-day-start terms: 5*1080+204.
 */
const BAHARAD_PARTS_AFTER_EPOCH_DAY = 5 * PARTS_PER_HOUR + 204; // 5604

/**
 * JD of 1 Tishrei, year 1 -- proleptically 7 October 3761 BCE (Julian
 * calendar), a Monday. `jdWeekday` of this value must be 1 (Monday); this
 * is asserted by the test suite, not just assumed.
 */
export const HEBREW_EPOCH_JD: JulianDay = julianToJD(-3760, 10, 7);

/**
 * True if `year` is a leap (13-month) year of the 19-year Metonic cycle.
 * Reingold & Dershowitz's closed form: leap years are exactly those with
 * `(7*year + 1) mod 19 < 7`, which for `year mod 19` produces the classic
 * leap set {3, 6, 8, 11, 14, 17, 19(=0)}.
 */
export function isHebrewLeapYear(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

/**
 * Number of months elapsed from 1 Tishrei year 1 to 1 Tishrei `year`
 * (i.e. the total month count of years `1 .. year-1`). Reingold &
 * Dershowitz's closed form: within each 19-year cycle, 12 regular months
 * per year plus the leap months accounted for by
 * `floor((7*r + 1) / 19)`, where `r` is the position in the cycle.
 */
function monthsElapsedBeforeYear(year: number): number {
  const y = year - 1;
  const cycles = Math.floor(y / 19);
  const r = mod(y, 19);
  return 235 * cycles + 12 * r + Math.floor((7 * r + 1) / 19);
}

/** The mean lunar conjunction (molad) of Tishrei for `hebrewYear`, chained from BaHaRaD. */
export function moladTishrei(hebrewYear: number): Molad {
  const totalParts =
    BAHARAD_PARTS_AFTER_EPOCH_DAY + monthsElapsedBeforeYear(hebrewYear) * MOLAD_INTERVAL_PARTS;
  const days = Math.floor(totalParts / PARTS_PER_DAY);
  const remainder = totalParts - days * PARTS_PER_DAY;
  const hour = Math.floor(remainder / PARTS_PER_HOUR);
  const part = remainder - hour * PARTS_PER_HOUR;
  const day = HEBREW_EPOCH_JD + days;
  return { day, hour, part, weekday: jdWeekday(day) };
}

/**
 * Rosh Hashanah (1 Tishrei) for `hebrewYear`, as a JD, after applying all
 * four dehiyyot (postponement rules) to the raw molad day:
 *
 * 1. Molad Zaken: molad at or after 18h (noon or later, civil time, since
 *    the Hebrew day begins at the previous 6pm) postpones by 1 day.
 * 2. Lo ADU Rosh: Rosh Hashanah may never land on Sunday, Wednesday, or
 *    Friday; postpone by 1 day if it would.
 * 3. GaTaRaD: in a non-leap year, a Tuesday molad at or after 9h204p
 *    postpones by 2 days (elif'd against rule 1: a Tuesday molad so late
 *    it also triggers rule 1 reaches the same Thursday result via rule 1 +
 *    rule 2, so the rules never double-count).
 * 4. BeTuTeKaFot: if the *previous* year was a leap year, a Monday molad
 *    at or after 15h589p postpones by 1 day.
 */
export function roshHashanah(hebrewYear: number): JulianDay {
  const molad = moladTishrei(hebrewYear);
  let postponement = 0;

  if (molad.hour >= 18) {
    postponement = 1;
  } else if (
    molad.weekday === 2 &&
    !isHebrewLeapYear(hebrewYear) &&
    (molad.hour > 9 || (molad.hour === 9 && molad.part >= 204))
  ) {
    postponement = 2;
  } else if (
    molad.weekday === 1 &&
    isHebrewLeapYear(hebrewYear - 1) &&
    (molad.hour > 15 || (molad.hour === 15 && molad.part >= 589))
  ) {
    postponement = 1;
  }

  const resultWeekday = mod(molad.weekday + postponement, 7);
  if (resultWeekday === 0 || resultWeekday === 3 || resultWeekday === 5) {
    postponement += 1;
  }

  return molad.day + postponement;
}

export type HebrewYearType = 'deficient' | 'regular' | 'complete';

export interface YearShape {
  length: number;
  type: HebrewYearType;
  /** 29 or 30. */
  cheshvanLength: number;
  /** 29 or 30. */
  kislevLength: number;
}

/**
 * A Hebrew year's length is only 353/354/355 days (383/384/385 if leap);
 * the 2-day variance is absorbed entirely by Cheshvan and Kislev, whose
 * lengths this function derives from the measured year length -- the
 * standard technique (Reingold & Dershowitz), rather than a separate closed
 * form for "is this Cheshvan/Kislev long or short".
 */
export function yearShape(year: number): YearShape {
  const length = roshHashanah(year + 1) - roshHashanah(year);
  const base = isHebrewLeapYear(year) ? 383 : 353;
  const extraDays = length - base; // 0 = deficient, 1 = regular, 2 = complete
  const type: HebrewYearType =
    extraDays === 0 ? 'deficient' : extraDays === 1 ? 'regular' : 'complete';
  return {
    length,
    type,
    cheshvanLength: extraDays >= 2 ? 30 : 29,
    kislevLength: extraDays >= 1 ? 30 : 29,
  };
}

interface MonthSpan {
  month: number;
  length: number;
}

/** Months of `year` in chronological order (Tishrei first), each with its length in days. */
export function hebrewMonthsInYear(year: number): MonthSpan[] {
  const leap = isHebrewLeapYear(year);
  const { cheshvanLength, kislevLength } = yearShape(year);
  const months: MonthSpan[] = [
    { month: 7, length: 30 }, // Tishrei
    { month: 8, length: cheshvanLength }, // Cheshvan
    { month: 9, length: kislevLength }, // Kislev
    { month: 10, length: 29 }, // Tevet
    { month: 11, length: 30 }, // Shevat
  ];
  if (leap) {
    months.push({ month: 12, length: 30 }); // Adar I
    months.push({ month: 13, length: 29 }); // Adar II
  } else {
    months.push({ month: 12, length: 29 }); // Adar
  }
  months.push({ month: 1, length: 30 }); // Nisan
  months.push({ month: 2, length: 29 }); // Iyar
  months.push({ month: 3, length: 30 }); // Sivan
  months.push({ month: 4, length: 29 }); // Tammuz
  months.push({ month: 5, length: 30 }); // Av
  months.push({ month: 6, length: 29 }); // Elul
  return months;
}

/** Name of `monthNumber` within `year` (resolves which "Adar" 12/13 means). */
export function monthName(year: number, monthNumber: number): string {
  const table = isHebrewLeapYear(year) ? HEBREW_MONTH_NAMES_LEAP : HEBREW_MONTH_NAMES_COMMON;
  return table[monthNumber - 1] ?? 'Nisan';
}

/** Hebrew-script name of `monthNumber` within `year`. */
export function monthNameHebrew(year: number, monthNumber: number): string {
  const table = isHebrewLeapYear(year) ? HEBREW_MONTH_NAMES_LEAP_HE : HEBREW_MONTH_NAMES_COMMON_HE;
  return table[monthNumber - 1] ?? 'ניסן';
}

export function toJD(date: HebrewDate): JulianDay {
  const months = hebrewMonthsInYear(date.year);
  let elapsed = 0;
  for (const { month, length } of months) {
    if (month === date.month) {
      return roshHashanah(date.year) + elapsed + (date.day - 1);
    }
    elapsed += length;
  }
  throw new RangeError(`invalid Hebrew month ${date.month} for year ${date.year}`);
}

export function fromJD(jd: JulianDay): HebrewDate {
  // Mean Hebrew year length (235 months/19 years, in days) gives a good
  // first estimate; roshHashanah brackets it exactly from there.
  const meanYearLength = (MOLAD_INTERVAL_PARTS * 235) / 19 / PARTS_PER_DAY;
  let year = Math.floor((jd - HEBREW_EPOCH_JD) / meanYearLength) + 1;
  while (roshHashanah(year) > jd) year -= 1;
  while (roshHashanah(year + 1) <= jd) year += 1;

  // Floor to a whole day: `jd` usually carries a time-of-day fraction (e.g.
  // "now"), but a Hebrew calendar date is day-granular.
  const dayOfYear = Math.floor(jd - roshHashanah(year));
  let elapsed = 0;
  for (const { month, length } of hebrewMonthsInYear(year)) {
    if (dayOfYear < elapsed + length) {
      return { year, month, day: dayOfYear - elapsed + 1 };
    }
    elapsed += length;
  }
  // Unreachable if yearShape/roshHashanah are self-consistent; fall back to
  // the last day of Elul rather than throwing on floating-point edge noise.
  return { year, month: 6, day: 29 };
}

const HEBREW_NUMERAL_VALUES: ReadonlyArray<readonly [number, string]> = [
  [400, 'ת'],
  [300, 'ש'],
  [200, 'ר'],
  [100, 'ק'],
  [90, 'צ'],
  [80, 'פ'],
  [70, 'ע'],
  [60, 'ס'],
  [50, 'נ'],
  [40, 'מ'],
  [30, 'ל'],
  [20, 'כ'],
  [10, 'י'],
  [9, 'ט'],
  [8, 'ח'],
  [7, 'ז'],
  [6, 'ו'],
  [5, 'ה'],
  [4, 'ד'],
  [3, 'ג'],
  [2, 'ב'],
  [1, 'א'],
];

function greedyHebrewLetters(value: number): string[] {
  let remaining = value;
  const letters: string[] = [];
  for (const [v, letter] of HEBREW_NUMERAL_VALUES) {
    while (remaining >= v) {
      letters.push(letter);
      remaining -= v;
    }
  }
  return letters;
}

function withHebrewPunctuation(letters: string[]): string {
  if (letters.length === 0) return '';
  if (letters.length === 1) return `${letters[0] ?? ''}׳`; // geresh after a single letter
  const last = letters.at(-1) ?? '';
  return `${letters.slice(0, -1).join('')}״${last}`; // gershayim before the last letter
}

/**
 * Standard Hebrew-letter numeral rendering (aleph=1 .. tav=400, combined
 * additively). Thousands are dropped by convention (5785 -> 785 -> תשפ״ה),
 * matching how Hebrew years are written on a Jewish calendar. 15 and 16 use
 * the substitute forms tet-vav (ט״ו) and tet-zayin (ט״ז) instead of the
 * naive yod-heh/yod-vav, which would spell letters adjacent to the divine
 * name -- a real, universally followed convention (e.g. the 15th of Shevat
 * is called "Tu BiShvat", from ט״ו).
 */
export function toHebrewNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  const num = ((Math.floor(n) - 1) % 1000) + 1; // drop thousands, keep 1..1000
  const hundreds = num - (num % 100);
  const tensUnits = num % 100;

  const letters = greedyHebrewLetters(hundreds);
  if (tensUnits === 15) {
    letters.push('ט', 'ו');
  } else if (tensUnits === 16) {
    letters.push('ט', 'ז');
  } else {
    letters.push(...greedyHebrewLetters(tensUnits));
  }
  return withHebrewPunctuation(letters);
}

/** Weekday names, 0 = Sunday .. 6 = Saturday, matching {@link jdWeekday}. */
const HEBREW_WEEKDAY_NAMES = [
  'Yom Rishon',
  'Yom Sheni',
  'Yom Shlishi',
  "Yom Revi'i",
  'Yom Chamishi',
  'Yom Shishi',
  'Shabbat',
];

export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const name = monthName(date.year, date.month);
  const nameHe = monthNameHebrew(date.year, date.month);
  const dayHe = toHebrewNumeral(date.day);
  const yearHe = toHebrewNumeral(date.year);
  const transliteration = `${date.day} ${name} ${date.year}`;

  // The body line adds information beyond the title: weekday, this
  // month's actual length, and the year's shape - not a repeat of the date.
  const weekday = HEBREW_WEEKDAY_NAMES[jdWeekday(jd)] ?? 'Yom Rishon';
  const months = hebrewMonthsInYear(date.year);
  const thisMonth = months.find((m) => m.month === date.month);
  const shape = yearShape(date.year);
  const leapNote = isHebrewLeapYear(date.year)
    ? 'leap year (13 months)'
    : 'common year (12 months)';
  const summary = `${weekday}; ${name} has ${thisMonth?.length ?? 29} days this year; a ${shape.type} ${leapNote}, ${shape.length} days total.`;

  return {
    id: 'hebrew',
    name: 'Hebrew Calendar',
    native: `${dayHe} ${nameHe} ${yearHe}`,
    transliteration,
    summary,
    method:
      'Exact molad (mean lunar conjunction) arithmetic chained from the traditional epoch molad ' +
      '(BaHaRaD, 2d 5h 204p after creation) through the 19-year Metonic cycle, with all four Rosh ' +
      'Hashanah postponement rules applied (Molad Zaken, Lo ADU Rosh, GaTaRaD, BeTuTeKaFot). ' +
      'Cheshvan/Kislev lengths are derived from the measured year length rather than a separate ' +
      'closed form. This is the fixed rabbinic-calendar arithmetic in continuous use since ' +
      'Maimonides codified it (12th c. CE), not a modern astronomical reconstruction.',
    isReconstruction: false,
  };
}
