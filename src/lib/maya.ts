/**
 * Maya calendar: the Long Count (a positional day count from the creation
 * epoch), the 260-day Tzolk'in and 365-day Haab' cycles, and the 9-day Lord
 * of the Night (G1-G9) cycle, plus a pure bar-and-dot numeral renderer.
 *
 * The Long Count's place values (kin/winal/tun/katun/baktun), the Tzolk'in
 * and Haab' cycles, and their interlocking arithmetic are the Maya's own
 * attested positional calendar (inscribed on stelae throughout the Classic
 * period) -- see Reingold & Dershowitz, *Calendrical Calculations: The
 * Ultimate Edition* (Cambridge University Press, 2018), the Maya calendar
 * chapter. This is attested historical arithmetic, not a modern
 * reconstruction, hence `isReconstruction: false`. The one modern input is
 * the correlation constant tying a Long Count day to a JD: this module
 * defaults to 584283, the Goodman-Martinez-Thompson (GMT) constant that is
 * the modern scholarly consensus, with 584285 (an alternative some scholars
 * use) selectable.
 */

import { amod, type JulianDay, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

export interface MayaLongCount {
  baktun: number;
  katun: number;
  tun: number;
  winal: number;
  kin: number;
}

export interface TzolkinDate {
  /** 1-13. */
  number: number;
  /** One of the 20 Tzolk'in day names. */
  name: string;
}

export interface HaabDate {
  /** 0-19 (0-4 within Wayeb'). */
  day: number;
  /** One of the 18 Haab' month names, or Wayeb'. */
  month: string;
}

export interface MayaDate {
  longCount: MayaLongCount;
  tzolkin: TzolkinDate;
  haab: HaabDate;
  /** One of G1-G9. */
  lordOfNight: string;
}

/** Goodman-Martinez-Thompson correlation constant: the modern scholarly consensus. */
export const GMT_CORRELATION_STANDARD = 584283;
/** Alternative GMT correlation constant used by some scholars (2 days later). */
export const GMT_CORRELATION_ALTERNATIVE = 584285;

export const TZOLKIN_DAY_NAMES: readonly string[] = [
  'Imix',
  "Ik'",
  "Ak'bal",
  "K'an",
  'Chikchan',
  'Kimi',
  "Manik'",
  'Lamat',
  'Muluk',
  'Ok',
  'Chuwen',
  "Eb'",
  "B'en",
  'Ix',
  'Men',
  "Kib'",
  'Kaban',
  "Etz'nab'",
  'Kawak',
  'Ajaw',
];

/** 18 named 20-day months followed by the 5-day Wayeb' (index 18). */
export const HAAB_MONTH_NAMES: readonly string[] = [
  'Pop',
  "Wo'",
  'Sip',
  "Sotz'",
  'Sek',
  'Xul',
  "Yaxk'in",
  'Mol',
  "Ch'en",
  'Yax',
  "Sak'",
  'Keh',
  'Mak',
  "K'ank'in",
  'Muwan',
  'Pax',
  "K'ayab",
  "Kumk'u",
  "Wayeb'",
];

/**
 * The 9-day Lord of the Night cycle, G1-G9. Which mod-9 residue maps to
 * which G-number is a widely-used epigraphic convention (G1 conventionally
 * at the Long Count creation epoch), not a settled fact -- some epigraphers
 * debate the correspondence. See `describe`'s `method` string.
 */
export const LORD_OF_NIGHT_NAMES: readonly string[] = [
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
];

function longCountToDays(lc: MayaLongCount): number {
  return lc.kin + lc.winal * 20 + lc.tun * 360 + lc.katun * 7200 + lc.baktun * 144000;
}

function longCountFromDays(d: number): MayaLongCount {
  const kin = mod(d, 20);
  const q1 = Math.floor(d / 20);
  const winal = mod(q1, 18);
  const q2 = Math.floor(q1 / 18);
  const tun = mod(q2, 20);
  const q3 = Math.floor(q2 / 20);
  const katun = mod(q3, 20);
  const baktun = Math.floor(q3 / 20);
  return { baktun, katun, tun, winal, kin };
}

function tzolkinFromDays(d: number): TzolkinDate {
  // 0.0.0.0.0 = 4 Ajaw: number 4 at d=0 fixes the +4 offset (amod keeps the
  // 1-13 range); Ajaw is the 20th name (index 19), fixing the +19 offset.
  const number = amod(d + 4, 13);
  const idx = mod(d + 19, 20);
  return { number, name: TZOLKIN_DAY_NAMES[idx] ?? TZOLKIN_DAY_NAMES[0] ?? 'Imix' };
}

function haabFromDays(d: number): HaabDate {
  // 0.0.0.0.0 = 8 Kumk'u: Kumk'u is Haab' month index 17 (18th month), so
  // position 17*20+8 = 348 must correspond to d=0, fixing the +348 offset.
  // Month/day both fall out of one division since 360 = 18*20 exactly, so
  // the Wayeb' days (positions 360-364) land at month index 18, day 0-4
  // with no separate branch needed.
  const pos = mod(d + 348, 365);
  const month = Math.floor(pos / 20);
  const day = pos % 20;
  return { day, month: HAAB_MONTH_NAMES[month] ?? HAAB_MONTH_NAMES[0] ?? 'Pop' };
}

/**
 * Days elapsed since the Long Count creation epoch (0.0.0.0.0) for `jd`,
 * under the given correlation constant.
 *
 * The GMT correlation constant is conventionally a noon-referenced Julian
 * Day Number; this library's JD values are midnight-referenced (a whole
 * calendar day's JD ends in .5, per `core/jd.ts`). Adding 0.5 before
 * flooring converts between the two conventions and avoids an off-by-one
 * day against the correlation constant (verified against both canonical
 * checks in the test suite: 2012-12-21 = 13.0.0.0.0, and day 0 = 4 Ajaw 8
 * Kumk'u).
 */
function daysSinceCreation(jd: JulianDay, correlation: number): number {
  return Math.floor(jd - correlation + 0.5);
}

export function longCountFromJD(
  jd: JulianDay,
  correlation: number = GMT_CORRELATION_STANDARD,
): MayaLongCount {
  return longCountFromDays(daysSinceCreation(jd, correlation));
}

export function jdFromLongCount(
  lc: MayaLongCount,
  correlation: number = GMT_CORRELATION_STANDARD,
): JulianDay {
  return correlation - 0.5 + longCountToDays(lc);
}

export function tzolkinFromJD(
  jd: JulianDay,
  correlation: number = GMT_CORRELATION_STANDARD,
): TzolkinDate {
  return tzolkinFromDays(daysSinceCreation(jd, correlation));
}

export function haabFromJD(
  jd: JulianDay,
  correlation: number = GMT_CORRELATION_STANDARD,
): HaabDate {
  return haabFromDays(daysSinceCreation(jd, correlation));
}

export function lordOfNightFromJD(
  jd: JulianDay,
  correlation: number = GMT_CORRELATION_STANDARD,
): string {
  const d = daysSinceCreation(jd, correlation);
  return LORD_OF_NIGHT_NAMES[mod(d, 9)] ?? 'G1';
}

export function fromJD(jd: JulianDay, correlation: number = GMT_CORRELATION_STANDARD): MayaDate {
  const d = daysSinceCreation(jd, correlation);
  return {
    longCount: longCountFromDays(d),
    tzolkin: tzolkinFromDays(d),
    haab: haabFromDays(d),
    lordOfNight: LORD_OF_NIGHT_NAMES[mod(d, 9)] ?? 'G1',
  };
}

/** Only the Long Count component uniquely determines a JD (Tzolk'in/Haab' alone repeat every 260/365 days). */
export function toJD(date: MayaDate, correlation: number = GMT_CORRELATION_STANDARD): JulianDay {
  return jdFromLongCount(date.longCount, correlation);
}

function formatLongCount(lc: MayaLongCount): string {
  return `${lc.baktun}.${lc.katun}.${lc.tun}.${lc.winal}.${lc.kin}`;
}

export function describe(
  jd: JulianDay,
  correlation: number = GMT_CORRELATION_STANDARD,
): CalendarTablet {
  const date = fromJD(jd, correlation);
  const lcString = formatLongCount(date.longCount);
  const tzolkinString = `${date.tzolkin.number} ${date.tzolkin.name}`;
  const haabString = `${date.haab.day} ${date.haab.month}`;
  const native = `${lcString} ${tzolkinString} ${haabString}`;
  const correlationNote =
    correlation === GMT_CORRELATION_STANDARD
      ? 'modern consensus'
      : correlation === GMT_CORRELATION_ALTERNATIVE
        ? 'an alternative some scholars use'
        : 'a non-standard correlation supplied by the caller';

  return {
    id: 'maya-long-count',
    name: 'Maya Calendar',
    native,
    transliteration: native,
    summary: `Long Count ${lcString}, Tzolk'in ${tzolkinString}, Haab' ${haabString}`,
    method: `Base-20 positional Long Count (base-18 at the winal-to-tun place) from the Maya creation epoch, correlated to JD via the Goodman-Martinez-Thompson constant ${correlation} (${correlationNote}). Tzolk'in (260-day) and Haab' (365-day, no leap day) are derived by direct modular arithmetic against the same day count. The G1-G9 Lord of the Night label is a widely-used epigraphic convention, not settled fact. This is the Maya's own attested calendar arithmetic, not a modern reconstruction.`,
    isReconstruction: false,
  };
}

/**
 * Pure bar-and-dot (Maya vigesimal) numeral for `n` (0-19, clamped) as a
 * standalone SVG string: dot = 1 (max 4, in a row), bar = 5 (max 3,
 * stacked below the dots), 0 = a shell glyph. Uses `currentColor` so the
 * caller can theme it, and builds the markup as a plain string (no DOM),
 * so it works identically from Node (tests) and the browser.
 */
export function mayaNumeralSVG(n: number, options?: { size?: number }): string {
  const value = Math.max(0, Math.min(19, Math.floor(Number.isFinite(n) ? n : 0)));
  const size = options?.size ?? 60;
  const width = size;

  if (value === 0) {
    const rx = size * 0.42;
    const ry = size * 0.28;
    const height = ry * 2 + size * 0.1;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Maya numeral 0">` +
      `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx}" ry="${ry}" fill="none" stroke="currentColor" stroke-width="${size * 0.06}" /></svg>`
    );
  }

  const bars = Math.floor(value / 5);
  const dots = value % 5;

  const dotRadius = size * 0.09;
  const dotGap = size * 0.06;
  const barWidth = size * 0.64;
  const barHeight = size * 0.16;
  const rowGap = size * 0.08;
  const padding = size * 0.08;

  const dotsRowHeight = dots > 0 ? dotRadius * 2 : 0;
  const barsHeight = bars > 0 ? bars * barHeight + (bars - 1) * rowGap : 0;
  const betweenDotsAndBars = dots > 0 && bars > 0 ? rowGap : 0;
  const height = padding * 2 + dotsRowHeight + betweenDotsAndBars + barsHeight;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Maya numeral ${value}">`,
  );

  let y = padding;
  if (dots > 0) {
    const cy = y + dotRadius;
    const totalDotsWidth = dots * (dotRadius * 2) + (dots - 1) * dotGap;
    let cx = width / 2 - totalDotsWidth / 2 + dotRadius;
    for (let i = 0; i < dots; i++) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${dotRadius}" fill="currentColor" />`);
      cx += dotRadius * 2 + dotGap;
    }
    y += dotsRowHeight + betweenDotsAndBars;
  }

  const barX = width / 2 - barWidth / 2;
  for (let i = 0; i < bars; i++) {
    parts.push(
      `<rect x="${barX}" y="${y}" width="${barWidth}" height="${barHeight}" rx="${barHeight * 0.3}" fill="currentColor" />`,
    );
    y += barHeight + rowGap;
  }

  parts.push('</svg>');
  return parts.join('');
}
