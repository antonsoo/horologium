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
 * Press, 2018), ch. 19. New moon and solar-term timings themselves come
 * from this project's own root-finding on the low-precision Sun/Moon
 * longitude formulas in `astronomy/sun-moon.ts` (Meeus 1998), not from a
 * separately-cited table.
 *
 * Because it depends on real new-moon and solstice instants, this module
 * is explicitly a *reconstruction*: the historical Chinese calendar was
 * set by court astronomers using the best ephemeris of their era, and
 * pre-modern rules (Season Granting / Shixian systems) occasionally used
 * a different, tropical-year-based mean-solar-term approximation for
 * zhongqi rather than a true (apparent) solar longitude. Treat dates more
 * than a few centuries from the present as illustrative rather than
 * archivally authoritative.
 */

import {
  findSolarLongitudeCrossing,
  nextNewMoon,
  previousNewMoon,
  solarTermBefore,
  sunLongitude,
} from './astronomy/sun-moon.js';
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
 * Sexagenary day. Julian Day Number 0 (1 Jan 4713 BCE proleptic Julian,
 * noon UT) is conventionally jiazi (index 0) in the continuous day count;
 * see Helmer Aslaksen, "The Mathematics of the Chinese Calendar" (National
 * University of Singapore), section on the sexagenary cycle. We use the
 * plain (UT) Julian Day Number here, matching that convention, rather than
 * the China-Standard-Time day used for month/year boundaries below.
 */
export function sexagenaryDay(jd: JulianDay): SexagenaryLabel {
  const jdn = Math.floor(jd + 0.5);
  return sexagenaryLabel(jdn);
}

/** Sexagenary year, indexed from the Chinese New Year the date falls after/on. 1984 CE is jiajzi (index 0). */
export function sexagenaryYear(chineseYearNumber: number): SexagenaryLabel {
  return sexagenaryLabel(mod(chineseYearNumber - 4, 60));
}

// --- Lunisolar month/day ----------------------------------------------------

/** Longitude bucket index (0-11) used to detect zhongqi (major term) crossings between two instants. */
function zhongqiBucket(jd: JulianDay): number {
  return Math.floor(mod(sunLongitude(jd) - 270, 360) / 30);
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
  startJD: JulianDay;
  number: number; // 1-12
  isLeap: boolean;
}

interface YearStructure {
  spans: MonthSpan[];
  cycleStartJD: JulianDay;
  /** Start of the *next* cycle's month 11 (i.e. one day past the end of this structure's last span). */
  cycleEndJD: JulianDay;
  /** The winter solstice that anchors the *next* cycle - a safe re-entry point past both cycleEndJD and its solstice. */
  nextSolsticeJD: JulianDay;
}

/**
 * Compute the full set of lunar months for the winter-solstice-to-winter-
 * solstice cycle containing `jd`, per the ch. 19 rule cited at the top of
 * this file.
 *
 * Note the direction of the search: `ws0` is the solstice at or before
 * `jd`, but month 11's new moon can fall *before* the solstice it anchors
 * (by up to ~29 days) - so if `jd` itself lands in that new-moon-to-
 * solstice gap of the *upcoming* cycle, naively searching backward for a
 * solstice still finds last year's, one full cycle too early. Callers must
 * check `jd` against `cycleEndJD` (see {@link chineseFromJD}) and re-anchor
 * using `nextSolsticeJD` when that happens.
 */
function computeYearStructure(jd: JulianDay): YearStructure {
  const ws0 = findSolarLongitudeCrossing(jd, 270, -1);
  const ws1 = findSolarLongitudeCrossing(ws0 + 10, 270, 1);

  const m11Start = previousNewMoon(ws0 + 0.5);
  const m11StartNext = previousNewMoon(ws1 + 0.5);

  // Collect new moons from this cycle's month 11 start up to *and including*
  // the next cycle's month 11 start (the list's final entry is that
  // terminator, not one of this cycle's own months - see monthCount below).
  const newMoons: JulianDay[] = [m11Start];
  while ((newMoons[newMoons.length - 1] as JulianDay) < m11StartNext - 1) {
    newMoons.push(nextNewMoon((newMoons[newMoons.length - 1] as JulianDay) + 1));
  }
  // Real months in this cycle = new moons collected minus the trailing
  // terminator (next cycle's month 11). 12 for an ordinary year, 13 when
  // this winter-solstice-to-winter-solstice span needs a leap month.
  const monthCount = newMoons.length - 1;

  const spans: MonthSpan[] = [];
  let current = 11;
  let leapAssigned = false;
  for (let i = 0; i < monthCount; i++) {
    const start = newMoons[i] as JulianDay;
    const end = i + 1 < monthCount ? (newMoons[i + 1] as JulianDay) : m11StartNext;
    const hasZhongqi = zhongqiBucketForLocalDay(start) !== zhongqiBucketForLocalDay(end);
    if (monthCount === 13 && !leapAssigned && i > 0 && !hasZhongqi) {
      // A leap month repeats the *preceding* month's number (e.g. a
      // zhongqi-less month right after month 9 is "leap 9", not "leap 10")
      // and does not consume the next regular number.
      const previous = spans[spans.length - 1] as MonthSpan;
      spans.push({ startJD: start, number: previous.number, isLeap: true });
      leapAssigned = true;
    } else {
      spans.push({ startJD: start, number: current, isLeap: false });
      current = current === 12 ? 1 : current + 1;
    }
  }
  return { spans, cycleStartJD: m11Start, cycleEndJD: m11StartNext, nextSolsticeJD: ws1 };
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
  let structure = computeYearStructure(jd);
  const localDay = localDayNumber(jd);

  // `jd` can fall on or after this cycle's `cycleEndJD` (the *next* cycle's
  // month-11 new moon) while still being before that cycle's solstice - see
  // the warning on computeYearStructure. Re-anchor past the solstice itself,
  // which is always a safe, unambiguous pivot.
  if (localDay >= localDayNumber(structure.cycleEndJD)) {
    structure = computeYearStructure(structure.nextSolsticeJD + 1);
  }
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
  const cnyYear = month1 ? jdToGregorian(month1.startJD).year : 0;
  const yearNumber = month1 && jd >= month1.startJD ? cnyYear : cnyYear - 1;

  return {
    yearNumber,
    month: span.number,
    isLeapMonth: span.isLeap,
    day,
    yearGanzhi: sexagenaryYear(yearNumber),
    dayGanzhi: sexagenaryDay(jd),
  };
}

/** JD of Chinese New Year (month 1, day 1) for the given nominal year number. */
export function chineseNewYear(yearNumber: number): JulianDay {
  // Chinese New Year always falls between 21 Jan and 21 Feb (Gregorian), so
  // 10 Jan of `yearNumber` is always after the preceding December solstice
  // (~21 Dec of yearNumber-1, which anchors month 11) and before New Year
  // itself - i.e. safely inside the correct winter-solstice-to-winter-
  // solstice cycle for `computeYearStructure` to resolve.
  const pivot = gregorianToJD(yearNumber, 1, 10);
  const { spans } = computeYearStructure(pivot);
  const month1 = spans.find((s) => s.number === 1 && !s.isLeap);
  if (!month1) throw new Error(`could not locate month 1 for Chinese year ${yearNumber}`);
  return month1.startJD;
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
  const term = solarTermBefore(jd);
  const native = `${d.yearGanzhi.han}年 ${monthLabel(d.month, d.isLeapMonth)}${dayLabel(d.day)} (${d.dayGanzhi.han}日)`;
  const transliteration = `${d.yearGanzhi.pinyin} year, ${d.isLeapMonth ? 'leap ' : ''}month ${d.month} day ${d.day} (${d.dayGanzhi.pinyin} day)`;
  return {
    id: 'chinese',
    name: 'Chinese Calendar',
    native,
    transliteration,
    summary: `Year of the ${d.yearGanzhi.branch.animal} (${d.yearGanzhi.stem.element}), ${d.yearNumber}; most recent solar term: ${term.nameEn} (${term.namePinyin}, ${term.nameHan})`,
    method:
      'Sexagenary day from the Julian Day Number (JD 0 = jiǎzǐ, a convention from calendrical literature). Lunisolar month/day computed astronomically in China Standard Time (UTC+8): months run new-moon to new-moon; the month containing the December solstice is month 11; a 13-lunation winter-solstice cycle gets one leap month, at the first zhongqi-less month after month 11. New moons and solar terms are root-found on this project’s own low-precision Sun/Moon longitude formulas (Meeus 1998), not read from a table — see docs/CALENDARS.md for measured accuracy.',
    isReconstruction: true,
  };
}
