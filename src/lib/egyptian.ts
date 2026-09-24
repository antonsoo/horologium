/**
 * Egyptian civil calendar: a pure 365-day "wandering" year with no leap
 * day, dated from Ptolemy's Era of Nabonassar, plus the Sothic-cycle
 * arithmetic that describes how that wandering year drifts against the
 * solar year.
 *
 * The month/season structure and the Era of Nabonassar epoch are Ptolemy's
 * own attested civil-calendar system (used by Hellenistic and Roman-era
 * astronomers precisely because its fixed 365-day year, with no leap-day
 * irregularity, makes date arithmetic trivial) -- see Reingold & Dershowitz,
 * *Calendrical Calculations: The Ultimate Edition* (Cambridge University
 * Press, 2018), the Egyptian calendar section, for the same 12x30+5
 * structure. This is attested historical arithmetic, not a modern
 * reconstruction, hence `isReconstruction: false`.
 */

import { type JulianDay, jdToJulian, julianToJD, mod } from './core/jd.js';
import type { CalendarTablet } from './types.js';

export interface EgyptianDate {
  /** Year of the Era of Nabonassar, starting at 1. */
  year: number;
  /** 1-12 for the civil months; 13 for the 5 epagomenal days. */
  month: number;
  /** 1-30 for months 1-12; 1-5 when month is 13 (epagomenal). */
  day: number;
}

export const EGYPTIAN_MONTH_NAMES: readonly string[] = [
  'Thoth',
  'Phaophi',
  'Athyr',
  'Choiak',
  'Tybi',
  'Mechir',
  'Phamenoth',
  'Pharmuthi',
  'Pachons',
  'Payni',
  'Epiphi',
  'Mesore',
];

/**
 * The 5 epagomenal ("little month") days appended after Mesore. Egyptian
 * myth associates each with a deity's birth (Osiris, Horus the Elder, Seth,
 * Isis, Nephthys, in that order per Plutarch's *De Iside et Osiride*), but
 * this module uses the plain ordinal label rather than assert that specific
 * day-to-deity mapping as settled fact.
 */
export const EGYPTIAN_EPAGOMENAL_NAMES: readonly string[] = [
  'Epagomenal day 1',
  'Epagomenal day 2',
  'Epagomenal day 3',
  'Epagomenal day 4',
  'Epagomenal day 5',
];

export const EGYPTIAN_SEASON_NAMES: readonly string[] = ['Akhet', 'Peret', 'Shemu'];

export interface EgyptianSeason {
  /** Akhet (inundation), Peret (growing), or Shemu (harvest). */
  name: string;
  /**
   * Unicode Egyptian Hieroglyphs (U+13000-U+1342F) codepoint for the
   * season, when confidently known. Intentionally omitted here: this
   * module's author was not confident of the correct Gardiner-sign to
   * Unicode-codepoint mapping for Akhet/Peret/Shemu at authoring time, and
   * a wrong glyph is worse than none (see `describe`'s `method` string).
   */
  hieroglyph?: string;
}

/**
 * JD of 1 Thoth, Year 1 of the Era of Nabonassar (Ptolemy's own epoch for
 * the Egyptian civil calendar), computed as the proleptic Julian date 26
 * February 747 BCE (astronomical year -746, per this library's julianToJD).
 * Ptolemy's tables cite the noon-referenced Julian Day Number as 1448638;
 * this library's JD convention is midnight-referenced (whole-day values end
 * in .5, per `core/jd.ts`), so `EGYPTIAN_EPOCH_JD + 0.5 === 1448638` exactly
 * -- not a discrepancy, just the noon/midnight JD convention difference.
 */
export const EGYPTIAN_EPOCH_JD: JulianDay = julianToJD(-746, 2, 26);

export function fromJD(jd: JulianDay): EgyptianDate {
  const daysSinceEpoch = Math.floor(jd - EGYPTIAN_EPOCH_JD);
  const yearIndex = Math.floor(daysSinceEpoch / 365);
  const dayOfYear = mod(daysSinceEpoch, 365);
  // month/day fall out of one uniform division: for the epagomenal days
  // (dayOfYear 360-364) this naturally yields month 13, day 1-5, since
  // 360 = 12*30 exactly -- no separate branch needed.
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return { year: yearIndex + 1, month, day };
}

export function toJD(date: EgyptianDate): JulianDay {
  const daysSinceEpoch = (date.year - 1) * 365 + (date.month - 1) * 30 + (date.day - 1);
  return EGYPTIAN_EPOCH_JD + daysSinceEpoch;
}

/** Season for a civil month (1-12); `null` for the epagomenal days (month 13), which fall outside all three seasons. */
export function seasonForMonth(month: number): EgyptianSeason | null {
  if (month < 1 || month > 12) return null;
  const idx = Math.floor((month - 1) / 4);
  return { name: EGYPTIAN_SEASON_NAMES[idx] ?? 'Akhet' };
}

const SOTHIC_CENSORINUS_ANCHOR_CE = 139;
const SOTHIC_CYCLE_YEARS = 1460;

export interface SothicCyclePosition {
  /** Years elapsed since the most recent civil-year/Sothic-year alignment, 0-1459. */
  yearsIntoCycle: number;
  /** The literary anchor year (CE) this position is measured against. */
  cycleAnchorCE: number;
}

/**
 * Position within the ~1460-year Sothic cycle (the span for the 365-day
 * civil year, losing ~1 day every 4 years against the ~365.25-day Sothic
 * year, to drift a full year and realign).
 *
 * The single input datum is Censorinus's report (*De Die Natali*, 238 CE)
 * that 1 Thoth coincided with the heliacal rising of Sirius in an Egyptian
 * year equivalent to 139 CE -- an ancient literary attestation, taken here
 * as given rather than independently re-derived (this library has no way to
 * verify an ancient naked-eye observation). Arithmetic self-consistency
 * check: one cycle before 139 CE is `139 - 1460 = -1321`, i.e. 1322 BCE,
 * matching the conventionally cited start of the preceding Sothic cycle.
 */
export function sothicCyclePosition(jd: JulianDay): SothicCyclePosition {
  const year = jdToJulian(jd).year;
  const yearsIntoCycle = mod(year - SOTHIC_CENSORINUS_ANCHOR_CE, SOTHIC_CYCLE_YEARS);
  return { yearsIntoCycle, cycleAnchorCE: SOTHIC_CENSORINUS_ANCHOR_CE };
}

export function describe(jd: JulianDay): CalendarTablet {
  const date = fromJD(jd);
  const isEpagomenal = date.month === 13;
  const monthLabel = isEpagomenal
    ? (EGYPTIAN_EPAGOMENAL_NAMES[date.day - 1] ?? 'Epagomenal day')
    : (EGYPTIAN_MONTH_NAMES[date.month - 1] ?? 'Thoth');
  const summary = isEpagomenal
    ? `${monthLabel}, year ${date.year} of Nabonassar`
    : `${date.day} ${monthLabel}, year ${date.year} of Nabonassar`;

  return {
    id: 'egyptian',
    name: 'Egyptian Civil Calendar',
    native: summary,
    transliteration: summary,
    summary,
    method:
      'Ptolemy’s Era of Nabonassar epoch (1 Thoth, Year 1 = 26 Feb 747 BCE Julian). 12 months ' +
      'of 30 days across 3 seasons (Akhet/Peret/Shemu) plus 5 epagomenal days, with no leap day ever ' +
      '-- the wandering year drifts about 1 day every 4 years against the solar year, completing a ' +
      'Sothic cycle (Censorinus’s 139 CE anchor) in about 1460 years. Season hieroglyphs are ' +
      'omitted pending a confidently verified Gardiner-sign-to-Unicode mapping. This is Ptolemy’s ' +
      'own attested civil-calendar arithmetic, not a modern reconstruction.',
    isReconstruction: false,
  };
}
