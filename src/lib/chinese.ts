/**
 * Chinese sexagenary cycle and astronomical lunisolar calendar.
 *
 * The lunisolar month/day computation follows the standard rule used by
 * the Hong Kong Observatory and (in essence) the Chinese national standard
 * GB/T 33661-2017: months run from new moon to new moon in China Standard
 * Time (UTC+8); the month containing the December solstice is month 11;
 * and if the span between two consecutive "month 11"s contains 13 new
 * moons, the first of those months (after month 11) that contains no
 * *zhongqi* (a major solar term, i.e. no crossing of a 30-degree ecliptic
 * longitude boundary) is the leap month, repeating the previous month's
 * number. This structural rule is described in Reingold & Dershowitz,
 * *Calendrical Calculations: The Ultimate Edition* (Cambridge University
 * Press, 2018), ch. 19. New moons use Meeus's ch. 49 phase series; solar
 * terms use ch. 25 apparent solar longitude. Both are evaluated in TT and
 * converted to estimated UT with the Espenak-Meeus Delta-T polynomials.
 *
 * Because it depends on real new-moon and solstice instants, this module
 * is explicitly a *reconstruction*: the historical Chinese calendar was
 * set by court astronomers using the best ephemeris of their era, and
 * pre-modern rules (Season Granting / Shixian systems) occasionally used
 * a different, tropical-year-based mean-solar-term approximation for
 * zhongqi rather than a true (apparent) solar longitude. Treat dates more
 * than a few centuries from the present as illustrative rather than
 * archivally authoritative. UTC+8 is used throughout: this is a projection
 * of modern rules, not a reconstruction of historical Beijing clock time.
 */

import {
  calendarNewMoon,
  calendarSolarCrossing,
  calendarSunLongitude,
  lunationBefore,
  universalToTerrestrial,
} from './astronomy/calendar-events.js';
import { solarTermBefore } from './astronomy/sun-moon.js';
import type { JulianDay } from './core/jd.js';
import { gregorianToJD, jdToGregorian, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

const CHINA_UTC_OFFSET_DAYS = 8 / 24;

/** The local (China Standard Time) calendar day number containing `jd`. */
function localDayNumber(jd: JulianDay): number {
  return Math.floor(jd + CHINA_UTC_OFFSET_DAYS + 0.5);
}

export const HEAVENLY_STEMS = [
  { han: '甲', pinyin: 'jiǎ', element: 'Wood', yinYang: 'Yang' },
  { han: '乙', pinyin: 'yǐ', element: 'Wood', yinYang: 'Yin' },
  { han: '丙', pinyin: 'bǐng', element: 'Fire', yinYang: 'Yang' },
  { han: '丁', pinyin: 'dīng', element: 'Fire', yinYang: 'Yin' },
  { han: '戊', pinyin: 'wù', element: 'Earth', yinYang: 'Yang' },
  { han: '己', pinyin: 'jǐ', element: 'Earth', yinYang: 'Yin' },
  { han: '庚', pinyin: 'gēng', element: 'Metal', yinYang: 'Yang' },
  { han: '辛', pinyin: 'xīn', element: 'Metal', yinYang: 'Yin' },
  { han: '壬', pinyin: 'rén', element: 'Water', yinYang: 'Yang' },
  { han: '癸', pinyin: 'guǐ', element: 'Water', yinYang: 'Yin' },
] as const;

export const EARTHLY_BRANCHES = [
  { han: '子', pinyin: 'zǐ', animal: 'Rat' },
  { han: '丑', pinyin: 'chǒu', animal: 'Ox' },
  { han: '寅', pinyin: 'yín', animal: 'Tiger' },
  { han: '卯', pinyin: 'mǎo', animal: 'Rabbit' },
  { han: '辰', pinyin: 'chén', animal: 'Dragon' },
  { han: '巳', pinyin: 'sì', animal: 'Snake' },
  { han: '午', pinyin: 'wǔ', animal: 'Horse' },
  { han: '未', pinyin: 'wèi', animal: 'Goat' },
  { han: '申', pinyin: 'shēn', animal: 'Monkey' },
  { han: '酉', pinyin: 'yǒu', animal: 'Rooster' },
  { han: '戌', pinyin: 'xū', animal: 'Dog' },
  { han: '亥', pinyin: 'hài', animal: 'Pig' },
] as const;

export interface SexagenaryLabel {
  index: number; // 0-59, 0 = jiazi (甲子)
  stem: (typeof HEAVENLY_STEMS)[number];
  branch: (typeof EARTHLY_BRANCHES)[number];
  han: string; // e.g. "甲子"
  pinyin: string; // e.g. "jiǎzǐ"
}

function sexagenaryLabel(index60: number): SexagenaryLabel {
  const index = mod(index60, 60);
  const stem = HEAVENLY_STEMS[index % 10] as (typeof HEAVENLY_STEMS)[number];
  const branch = EARTHLY_BRANCHES[index % 12] as (typeof EARTHLY_BRANCHES)[number];
  return {
    index,
    stem,
    branch,
    han: `${stem.han}${branch.han}`,
    pinyin: `${stem.pinyin}${branch.pinyin}`,
  };
}

/**
 * Sexagenary day in UTC+8, with the same midnight as the lunar date.
 * 7 January 2000 is jiazi: local JDN 2451551, not JDN 0.
 * Y. T. Liu, Sexagenary Cycle, equation (1):
 * https://ytliu0.github.io/ChineseCalendar/sexagenary.html
 */
export function sexagenaryDay(jd: JulianDay): SexagenaryLabel {
  checkJD(jd);
  return sexagenaryLabel(localDayNumber(jd) + 49);
}

/** Sexagenary year, indexed from the Chinese New Year the date falls after/on. 1984 CE is jiazi (index 0). */
export function sexagenaryYear(chineseYearNumber: number): SexagenaryLabel {
  return sexagenaryLabel(mod(chineseYearNumber - 4, 60));
}

// --- Lunisolar month/day ----------------------------------------------------

/** Longitude bucket index (0-11) used to detect zhongqi (major term) crossings between two instants. */
function zhongqiBucket(jd: JulianDay): number {
  return Math.floor(mod(calendarSunLongitude(jd) - 270, 360) / 30);
}

/**
 * The Chinese calendar's leap-month rule is defined on *civil days* (China
 * Standard Time), not exact instants: a zhongqi "belongs" to whichever
 * China-Standard-Time day it falls on, same as a new moon does. When a
 * zhongqi and a month-boundary new moon land on the same CST day (this
 * happens for real historical leap months, e.g. 2014's leap 9th month,
 * where Xiaoxue fell about 3 hours before that day's new moon), comparing
 * bucket(startInstant) vs bucket(endInstant) directly would misclassify
 * the month. Sampling the Sun's longitude at the very start (local
 * midnight) of each boundary's civil day - rather than at the new moon's
 * exact instant - keeps the bucket comparison aligned with the civil-day
 * rule: a day only counts as "past" a zhongqi once the whole day, from its
 * first instant, is past it, so a zhongqi occurring later that same day is
 * correctly attributed to the day itself rather than to whatever preceded
 * it within the day.
 */
function zhongqiBucketForLocalDay(jd: JulianDay): number {
  return zhongqiBucket(localDayNumber(jd) - 0.5 - CHINA_UTC_OFFSET_DAYS);
}

interface MonthSpan {
  startJD: JulianDay; // local midnight, expressed as a UTC JD
  endJD: JulianDay; // exclusive local midnight
  newMoonJD: JulianDay; // estimated instant, not the start of the civil day
  nextNewMoonJD: JulianDay;
  number: number; // 1-12
  isLeap: boolean;
}

interface YearStructure {
  spans: MonthSpan[];
  cycleStartJD: JulianDay;
  /** Start of the *next* cycle's month 11 (i.e. one day past the end of this structure's last span). */
  cycleEndJD: JulianDay;
  solsticeJD: JulianDay;
  nextSolsticeJD: JulianDay;
}

const MIN_JD = gregorianToJD(-5000, 1, 1);
const MAX_JD = gregorianToJD(5001, 1, 1);

function checkJD(jd: JulianDay): void {
  if (!Number.isFinite(jd) || jd < MIN_JD || jd >= MAX_JD) {
    throw new RangeError('Chinese calendar dates must be within Gregorian years -5000 to 5000');
  }
}

function checkYear(year: number, minimum = -5000): void {
  if (!Number.isInteger(year) || year < minimum || year > 5000) {
    throw new RangeError(`Chinese year must be an integer from ${minimum} to 5000`);
  }
}

function localMidnight(jd: JulianDay): JulianDay {
  return localDayNumber(jd) - 0.5 - CHINA_UTC_OFFSET_DAYS;
}

// A small bounded cache avoids recomputing 14 lunar events on every live tick.
// These structures never leave the module; callers cannot mutate the cache.
const cycles = new Map<number, YearStructure>();

/** Month 11 to month 11, anchored by the December solstice of `year`. */
function solsticeCycle(year: number): YearStructure {
  const cached = cycles.get(year);
  if (cached) return cached;
  const ws0 = calendarSolarCrossing(gregorianToJD(year, 12, 1), 270);
  const ws1 = calendarSolarCrossing(gregorianToJD(year + 1, 12, 1), 270);

  // Month 11 contains the *civil day* of the solstice. A new moon later on
  // that same day begins month 11; one on tomorrow's day does not. The old
  // arbitrary '+ 0.5 days' assigned December 2033 to the wrong lunation.
  const k0 = lunationBefore(localMidnight(ws0) + 1);
  const k1 = lunationBefore(localMidnight(ws1) + 1);
  const monthCount = k1 - k0;
  if (monthCount !== 12 && monthCount !== 13) {
    throw new RangeError('The astronomical model did not produce a 12- or 13-month solstice cycle');
  }

  const spans: MonthSpan[] = [];
  let current = 11;
  let leapAssigned = false;
  for (let i = 0; i < monthCount; i++) {
    const newMoonJD = calendarNewMoon(k0 + i);
    const start = localMidnight(newMoonJD);
    const nextNewMoonJD = calendarNewMoon(k0 + i + 1);
    const end = localMidnight(nextNewMoonJD);
    const hasZhongqi = zhongqiBucketForLocalDay(start) !== zhongqiBucketForLocalDay(end);
    if (monthCount === 13 && !leapAssigned && i > 0 && !hasZhongqi) {
      // A leap month repeats the *preceding* month's number (e.g. a
      // zhongqi-less month right after month 9 is "leap 9", not "leap 10")
      // and does not consume the next regular number.
      const previous = spans[spans.length - 1] as MonthSpan;
      spans.push({
        startJD: start,
        endJD: end,
        newMoonJD,
        nextNewMoonJD,
        number: previous.number,
        isLeap: true,
      });
      leapAssigned = true;
    } else {
      spans.push({
        startJD: start,
        endJD: end,
        newMoonJD,
        nextNewMoonJD,
        number: current,
        isLeap: false,
      });
      current = current === 12 ? 1 : current + 1;
    }
  }
  const structure = {
    spans,
    cycleStartJD: localMidnight(calendarNewMoon(k0)),
    cycleEndJD: localMidnight(calendarNewMoon(k1)),
    solsticeJD: ws0,
    nextSolsticeJD: ws1,
  };
  if (cycles.size >= 16) cycles.delete(cycles.keys().next().value as number);
  cycles.set(year, structure);
  return structure;
}

export interface ChineseDate {
  /** "Nominal" Chinese year number: the Gregorian year of that year's New Year's Day. Comparable to Western year, not a count of years since an epoch. */
  yearNumber: number;
  month: number; // 1-12
  isLeapMonth: boolean;
  day: number; // 1-30
  yearGanzhi: SexagenaryLabel;
  dayGanzhi: SexagenaryLabel;
}

export function chineseFromJD(jd: JulianDay): ChineseDate {
  checkJD(jd);
  const year = jdToGregorian(jd + CHINA_UTC_OFFSET_DAYS).year;
  let structure = solsticeCycle(year);
  const localDay = localDayNumber(jd);

  if (localDay < localDayNumber(structure.cycleStartJD)) structure = solsticeCycle(year - 1);
  const { spans } = structure;

  let spanIndex = 0;
  for (let i = 0; i < spans.length; i++) {
    if (localDayNumber((spans[i] as MonthSpan).startJD) <= localDay) spanIndex = i;
  }
  const span = spans[spanIndex] as MonthSpan;
  const day = localDay - localDayNumber(span.startJD) + 1;

  // Find month 1 of this cycle to anchor the nominal year number; if `jd`
  // falls before month 1 starts (i.e. we're still in month 11/12), it
  // belongs to the Chinese year that is about to end, not the upcoming one.
  const month1 = spans.find((s) => s.number === 1 && !s.isLeap);
  // Gregorian year in which this cycle's Chinese New Year falls.
  if (!month1) throw new RangeError('The astronomical model did not produce a first lunar month');
  const cnyYear = jdToGregorian(month1.startJD + CHINA_UTC_OFFSET_DAYS).year;
  const yearNumber = localDay >= localDayNumber(month1.startJD) ? cnyYear : cnyYear - 1;

  return {
    yearNumber,
    month: span.number,
    isLeapMonth: span.isLeap,
    day,
    yearGanzhi: sexagenaryYear(yearNumber),
    dayGanzhi: sexagenaryDay(jd),
  };
}

/** UTC JD of the midnight in UTC+8 that starts Chinese New Year's Day.
 * This is a civil-day boundary, not the instant of the astronomical new moon.
 */
export function chineseNewYear(yearNumber: number): JulianDay {
  checkYear(yearNumber);
  const { spans } = solsticeCycle(yearNumber - 1);
  const month1 = spans.find((s) => s.number === 1 && !s.isLeap);
  if (!month1) throw new Error(`could not locate month 1 for Chinese year ${yearNumber}`);
  return month1.startJD;
}

export interface PrincipalTerm {
  longitudeDeg: number;
  name: string;
  /** Estimated event time, expressed as a UT JD; future UTC is not known. */
  jd: JulianDay;
}

export interface ChineseMonth {
  month: number;
  isLeapMonth: boolean;
  /** Inclusive/exclusive UTC+8 midnights, expressed as UTC JD values. */
  startJD: JulianDay;
  endJD: JulianDay;
  days: number;
  newMoonJD: JulianDay;
  nextNewMoonJD: JulianDay;
  principalTerms: PrincipalTerm[];
  /** Gregorian year of the December solstice anchoring this month-11 cycle. */
  solsticeYear: number;
  monthsInSolsticeCycle: 12 | 13;
  rule:
    | 'solstice-month'
    | 'leap-month'
    | 'has-principal-term'
    | 'twelve-month-cycle'
    | 'leap-already-assigned';
  /** Review flags for computed events within 15 minutes of local midnight.
   * This is a review threshold, not a certified error bound.
   */
  nearMidnight: Array<{ kind: 'new-moon' | 'next-new-moon' | 'principal-term'; jd: JulianDay }>;
}

export interface ChineseYear {
  schemaVersion: 1;
  yearNumber: number;
  startJD: JulianDay;
  endJD: JulianDay;
  clock: 'UTC+8';
  basis: 'modern-rule-calculation';
  eventTimeNote: string;
  nearMidnightThresholdMinutes: 15;
  /** Date-range limitation, separate from event-specific review flags. */
  note: string;
  months: ChineseMonth[];
}

const PRINCIPAL_TERM_NAMES = [
  'Spring equinox',
  'Grain rain',
  'Grain buds',
  'Summer solstice',
  'Major heat',
  'End of heat',
  'Autumn equinox',
  'Frost descent',
  'Minor snow',
  'Winter solstice',
  'Major cold',
  'Rain water',
] as const;

function principalTermsBetween(start: JulianDay, end: JulianDay): PrincipalTerm[] {
  const terms: PrincipalTerm[] = [];
  const first = Math.ceil(calendarSunLongitude(start) / 30);
  for (let i = 0; i < 3; i++) {
    const sector = (first + i) % 12;
    const jd = calendarSolarCrossing(start, sector * 30);
    if (jd >= end) break;
    terms.push({ longitudeDeg: sector * 30, name: PRINCIPAL_TERM_NAMES[sector] as string, jd });
  }
  return terms;
}

function nearMidnight(jd: JulianDay): boolean {
  const fraction = jd - localMidnight(jd);
  return Math.min(fraction, 1 - fraction) * 1440 < 15;
}

/** Inspect the months and event evidence for a New-Year-to-New-Year span.
 * Returned arrays/records are fresh snapshots, never references to the cache.
 */
export function inspectChineseYear(yearNumber: number): ChineseYear {
  // The first days of Gregorian -5000 belong to the preceding lunar year.
  checkYear(yearNumber, -5001);
  const before = solsticeCycle(yearNumber - 1);
  const after = solsticeCycle(yearNumber);
  const startJD = before.spans.find((span) => span.number === 1 && !span.isLeap)?.startJD;
  const endJD = after.spans.find((span) => span.number === 1 && !span.isLeap)?.startJD;
  if (startJD === undefined || endJD === undefined) {
    throw new RangeError('The astronomical model did not produce a first lunar month');
  }
  const months: ChineseMonth[] = [];
  for (const [solsticeYear, cycle] of [
    [yearNumber - 1, before],
    [yearNumber, after],
  ] as const) {
    for (const span of cycle.spans) {
      if (span.startJD < startJD || span.startJD >= endJD) continue;
      const principalTerms = principalTermsBetween(span.startJD, span.endJD);
      const flags: ChineseMonth['nearMidnight'] = [];
      if (nearMidnight(span.newMoonJD)) flags.push({ kind: 'new-moon', jd: span.newMoonJD });
      if (nearMidnight(span.nextNewMoonJD))
        flags.push({ kind: 'next-new-moon', jd: span.nextNewMoonJD });
      for (const term of principalTerms) {
        if (nearMidnight(term.jd)) flags.push({ kind: 'principal-term', jd: term.jd });
      }
      const rule = span.isLeap
        ? 'leap-month'
        : span.number === 11
          ? 'solstice-month'
          : principalTerms.length > 0
            ? 'has-principal-term'
            : cycle.spans.length === 12
              ? 'twelve-month-cycle'
              : 'leap-already-assigned';
      months.push({
        month: span.number,
        isLeapMonth: span.isLeap,
        startJD: span.startJD,
        endJD: span.endJD,
        days: Math.round(span.endJD - span.startJD),
        newMoonJD: span.newMoonJD,
        nextNewMoonJD: span.nextNewMoonJD,
        principalTerms,
        solsticeYear,
        monthsInSolsticeCycle: cycle.spans.length as 12 | 13,
        rule,
        nearMidnight: flags,
      });
    }
  }
  const note =
    yearNumber < 1929
      ? 'Modern rules projected backward in UTC+8. Historical Beijing time and earlier calendar rules can give different dates.'
      : yearNumber > 2099
        ? 'Astronomical projection. The full lunar year extends beyond the 1929–2100 daily comparison with Hong Kong Observatory.'
        : 'Modern rules in UTC+8. Month/day labels were checked against Hong Kong Observatory for 1929–2100; future events close to midnight can still move to another civil day.';
  return {
    schemaVersion: 1,
    yearNumber,
    startJD,
    endJD,
    clock: 'UTC+8',
    basis: 'modern-rule-calculation',
    eventTimeNote:
      'Approximate event instants from Meeus chapters 25 and 49, converted from TT to estimated UT with Espenak-Meeus Delta-T polynomials. Future UTC civil dates are not guaranteed.',
    nearMidnightThresholdMinutes: 15,
    note,
    months,
  };
}

const MONTH_NUMERALS = [
  '',
  '正',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
];

export function monthLabel(month: number, isLeap: boolean): string {
  const numeral = MONTH_NUMERALS[month] ?? String(month);
  return `${isLeap ? '闰' : ''}${numeral}月`;
}

const DAY_NUMERALS_TENS = ['初', '十', '廿', '三十'];
export function dayLabel(day: number): string {
  if (day === 30) return '三十';
  if (day === 20) return '二十';
  if (day === 10) return '初十';
  const tensDigit = Math.floor(day / 10);
  const onesDigit = day % 10;
  const onesHan = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][onesDigit];
  return `${DAY_NUMERALS_TENS[tensDigit]}${onesHan}`;
}

export function describe(jd: JulianDay): CalendarTablet {
  const d = chineseFromJD(jd);
  const term = solarTermBefore(universalToTerrestrial(jd));
  const native = `${d.yearGanzhi.han}年 ${monthLabel(d.month, d.isLeapMonth)}${dayLabel(d.day)} (${d.dayGanzhi.han}日)`;
  const transliteration = `${d.yearGanzhi.pinyin} year, ${d.isLeapMonth ? 'leap ' : ''}month ${d.month} day ${d.day} (${d.dayGanzhi.pinyin} day)`;
  return {
    id: 'chinese',
    name: 'Chinese Calendar',
    native,
    transliteration,
    summary: `Year of the ${d.yearGanzhi.branch.animal} (${d.yearGanzhi.stem.element}), ${d.yearNumber}; most recent solar term: ${term.nameEn} (${term.namePinyin}, ${term.nameHan})`,
    method:
      'All date parts change at midnight in UTC+8, including the sexagenary day (27 January 2019 = jiǎzǐ). A month starts on the civil day of a new moon. The month containing the December-solstice day is month 11. A 13-month cycle between consecutive month 11s assigns its first month without a principal solar term as a leap month. New moons use Meeus ch. 49; solar terms use ch. 25; Delta-T estimates convert astronomical time to civil time. This projects modern rules backward, without historical Beijing time or earlier calendar reforms. Inspect the lunar year for event times and limits.',
    isReconstruction: true,
    proleptic:
      jdToGregorian(jd + CHINA_UTC_OFFSET_DAYS).year < 1929
        ? 'Modern rules and UTC+8 projected backward. Historical Beijing time and earlier calendar rules can give different dates.'
        : undefined,
  };
}
