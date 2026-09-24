/**
 * Low-precision Sun and Moon ecliptic positions, phase, and the Metonic /
 * Callippic / Saros / Exeligmos eclipse-and-calendar cycles used by the
 * Antikythera mechanism's back dials.
 *
 * Formulas follow Jean Meeus, *Astronomical Algorithms*, 2nd ed.
 * (Willmann-Bell, 1998):
 *  - Sun: ch. 25, "Solar Coordinates" (the low-precision geometric method,
 *    accurate to about 0'.01 in longitude for a few centuries around 2000,
 *    degrading gracefully outside that span).
 *  - Moon: ch. 47's mean elements, truncated to the ten largest periodic
 *    terms of Table 47.A (the terms in D, M, M', F with coefficients
 *    >= 0.04 degrees). Full ELP2000-82B has ~60 terms; measured against
 *    Skyfield + JPL DE421 over 1900-2053 (tests/astronomy.test.ts), this
 *    truncation's worst error is about 0.68 degrees, well under 1 degree.
 *    Expect it to degrade further over the +/-5000 year range the rest of
 *    this project covers, where it is unverified (DE421 doesn't reach that
 *    far) and should be read as illustrative, not precise.
 *
 * New moon and solstice/equinox/solar-term times are *not* looked up from a
 * periodic-term table (Meeus ch. 49 has ~14 correction terms we do not
 * reproduce); instead we root-find directly on these same longitude
 * formulas, which keeps every derived quantity internally consistent.
 */

import type { JulianDay } from '../core/jd.js';

const DEG = Math.PI / 180;

function normalizeDegrees(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function centuriesSinceJ2000(jd: JulianDay): number {
  return (jd - 2451545.0) / 36525;
}

export interface EclipticPosition {
  /** Apparent ecliptic longitude, degrees, 0-360. */
  longitudeDeg: number;
}

/**
 * Apparent geocentric ecliptic longitude of the Sun.
 * Meeus (1998) ch. 25, eqs. 25.2-25.9 (low-precision method), including the
 * nutation/aberration correction of eq. 25.8.
 */
export function sunLongitude(jd: JulianDay): number {
  const t = centuriesSinceJ2000(jd);
  const l0 = normalizeDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = normalizeDegrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const mRad = m * DEG;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
    0.000289 * Math.sin(3 * mRad);
  const trueLongitude = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const apparent = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return normalizeDegrees(apparent);
}

/**
 * Geocentric ecliptic longitude of the Moon (truncated periodic series).
 * Meeus (1998) ch. 47, mean elements (47.1-47.5) plus the ten largest
 * longitude periodic terms of Table 47.A.
 */
export function moonLongitude(jd: JulianDay): number {
  const t = centuriesSinceJ2000(jd);
  const lp = normalizeDegrees(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t);
  const d = normalizeDegrees(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t);
  const m = normalizeDegrees(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t);
  const mp = normalizeDegrees(134.9633964 + 477198.8675055 * t + 0.008997 * t * t);
  const f = normalizeDegrees(93.272095 + 483202.0175233 * t - 0.0036539 * t * t);

  const [dR, mR, mpR, fR] = [d * DEG, m * DEG, mp * DEG, f * DEG];

  const terms = [
    { coeff: 6.28875, d: 0, m: 0, mp: 1, f: 0 },
    { coeff: 1.274, d: 2, m: 0, mp: -1, f: 0 },
    { coeff: 0.658, d: 2, m: 0, mp: 0, f: 0 },
    { coeff: -0.214, d: 0, m: 0, mp: 2, f: 0 },
    { coeff: -0.11, d: 1, m: 0, mp: 0, f: 0 },
    { coeff: -0.0573, d: 2, m: -1, mp: -1, f: 0 },
    { coeff: 0.0533, d: 2, m: 0, mp: 1, f: 0 },
    { coeff: 0.0459, d: 2, m: -1, mp: 0, f: 0 },
    { coeff: 0.0397, d: 0, m: 1, mp: -1, f: 0 },
    { coeff: -0.0347, d: 1, m: 1, mp: 0, f: 0 },
  ];

  let sum = 0;
  for (const term of terms) {
    const arg = term.d * dR + term.m * mR + term.mp * mpR + term.f * fR;
    sum += term.coeff * Math.sin(arg);
  }
  return normalizeDegrees(lp + sum);
}

/** Mean elongation of the Moon from the Sun, degrees, used for phase. */
export function moonElongation(jd: JulianDay): number {
  return normalizeDegrees(moonLongitude(jd) - sunLongitude(jd));
}

export interface MoonPhase {
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  elongationDeg: number;
  /** Illuminated fraction of the disk, 0-1. */
  illuminatedFraction: number;
  /** Age since the preceding new moon, in days (mean synodic month approximation refined by root-finding). */
  ageDays: number;
  /** Human label for the phase. */
  label: string;
}

const SYNODIC_MONTH = 29.530588861;

/** Full Moon phase description: elongation, illuminated fraction, age, label. */
export function moonPhase(jd: JulianDay): MoonPhase {
  const elongationDeg = moonElongation(jd);
  const elongationRad = elongationDeg * DEG;
  const illuminatedFraction = (1 - Math.cos(elongationRad)) / 2;
  const lastNew = previousNewMoon(jd);
  const ageDays = jd - lastNew;

  let label: string;
  if (elongationDeg < 1 || elongationDeg > 359) label = 'New Moon';
  else if (elongationDeg < 89) label = 'Waxing Crescent';
  else if (elongationDeg < 91) label = 'First Quarter';
  else if (elongationDeg < 179) label = 'Waxing Gibbous';
  else if (elongationDeg < 181) label = 'Full Moon';
  else if (elongationDeg < 269) label = 'Waning Gibbous';
  else if (elongationDeg < 271) label = 'Last Quarter';
  else label = 'Waning Crescent';

  return { elongationDeg, illuminatedFraction, ageDays, label };
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

/** Tropical zodiac sign for an ecliptic longitude (0 deg = Aries ingress at the equinox point). */
export function zodiacSign(longitudeDeg: number): string {
  const idx = Math.floor(normalizeDegrees(longitudeDeg) / 30);
  return ZODIAC_SIGNS[idx] ?? ZODIAC_SIGNS[0];
}

/**
 * Root-find the JD nearest `jd` where `elongation(x) - target` crosses zero,
 * by walking backward/forward from a mean-synodic-month estimate and then
 * refining with bisection. `direction` picks the nearest crossing before
 * (-1) or after (+1) `jd`.
 */
function findElongationCrossing(jd: JulianDay, targetDeg: number, direction: -1 | 1): JulianDay {
  const f = (x: JulianDay) => {
    const e = moonElongation(x) - targetDeg;
    return ((((e + 180) % 360) + 360) % 360) - 180;
  };
  // Coarse step in the requested direction until the sign flips.
  const step = direction * (SYNODIC_MONTH / 24); // ~1.23 days, safely under half a lunation
  let a = jd;
  let fa = f(a);
  let b = a;
  let fb = fa;
  for (let i = 0; i < 40; i++) {
    b = a + step;
    fb = f(b);
    // A real root has fa/fb close together with opposite signs; the +-180
    // wrap point (target+180 away) also flips Math.sign but jumps by ~360,
    // so exclude that case or we'll "find" a root 6 lunar months off target.
    if (fb === 0 || (Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 180)) break;
    a = b;
    fa = fb;
  }
  // Bisection refinement to sub-minute precision.
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  let flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (fmid === 0) return mid;
    if (Math.sign(fmid) === Math.sign(flo)) {
      lo = mid;
      flo = fmid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** JD of the new moon (elongation 0) immediately before `jd`. */
export function previousNewMoon(jd: JulianDay): JulianDay {
  return findElongationCrossing(jd - 0.01, 0, -1);
}

/** JD of the new moon (elongation 0) immediately at or after `jd`. */
export function nextNewMoon(jd: JulianDay): JulianDay {
  return findElongationCrossing(jd + 0.01, 0, 1);
}

/**
 * Root-find the JD nearest `jd` where the Sun's apparent longitude crosses
 * `targetDeg` (used for equinoxes/solstices at 0/90/180/270 and the 24
 * Chinese solar terms at multiples of 15 degrees).
 */
export function findSolarLongitudeCrossing(
  jd: JulianDay,
  targetDeg: number,
  direction: -1 | 1,
): JulianDay {
  const f = (x: JulianDay) => {
    const e = sunLongitude(x) - normalizeDegrees(targetDeg);
    return ((((e + 180) % 360) + 360) % 360) - 180;
  };
  const step = direction * 3.5; // tropical year / ~104, well under 15 deg of solar motion
  let a = jd;
  let fa = f(a);
  let b = a;
  let fb = fa;
  for (let i = 0; i < 200; i++) {
    b = a + step;
    fb = f(b);
    // See the identical guard in findElongationCrossing: reject the
    // antipodal (target+180) wrap, which also flips Math.sign but is not
    // a real crossing of `targetDeg`.
    if (fb === 0 || (Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 180)) break;
    a = b;
    fa = fb;
  }
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  let flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (fmid === 0) return mid;
    if (Math.sign(fmid) === Math.sign(flo)) {
      lo = mid;
      flo = fmid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export interface SolarTerm {
  /** 0-23, the index of the jieqi/zhongqi in the 24 solar terms starting at longitude 315 deg (Lichun). */
  index: number;
  nameEn: string;
  namePinyin: string;
  nameHan: string;
  jd: JulianDay;
}

const SOLAR_TERM_NAMES: Array<{ pinyin: string; han: string; en: string }> = [
  { pinyin: 'Lichun', han: '立春', en: 'Start of Spring' },
  { pinyin: 'Yushui', han: '雨水', en: 'Rain Water' },
  { pinyin: 'Jingzhe', han: '惊蛰', en: 'Awakening of Insects' },
  { pinyin: 'Chunfen', han: '春分', en: 'Spring Equinox' },
  { pinyin: 'Qingming', han: '清明', en: 'Clear and Bright' },
  { pinyin: 'Guyu', han: '谷雨', en: 'Grain Rain' },
  { pinyin: 'Lixia', han: '立夏', en: 'Start of Summer' },
  { pinyin: 'Xiaoman', han: '小满', en: 'Grain Buds' },
  { pinyin: 'Mangzhong', han: '芒种', en: 'Grain in Ear' },
  { pinyin: 'Xiazhi', han: '夏至', en: 'Summer Solstice' },
  { pinyin: 'Xiaoshu', han: '小暑', en: 'Minor Heat' },
  { pinyin: 'Dashu', han: '大暑', en: 'Major Heat' },
  { pinyin: 'Liqiu', han: '立秋', en: 'Start of Autumn' },
  { pinyin: 'Chushu', han: '处暑', en: 'End of Heat' },
  { pinyin: 'Bailu', han: '白露', en: 'White Dew' },
  { pinyin: 'Qiufen', han: '秋分', en: 'Autumn Equinox' },
  { pinyin: 'Hanlu', han: '寒露', en: 'Cold Dew' },
  { pinyin: 'Shuangjiang', han: '霜降', en: 'Frost Descent' },
  { pinyin: 'Lidong', han: '立冬', en: 'Start of Winter' },
  { pinyin: 'Xiaoxue', han: '小雪', en: 'Minor Snow' },
  { pinyin: 'Daxue', han: '大雪', en: 'Major Snow' },
  { pinyin: 'Dongzhi', han: '冬至', en: 'Winter Solstice' },
  { pinyin: 'Xiaohan', han: '小寒', en: 'Minor Cold' },
  { pinyin: 'Dahan', han: '大寒', en: 'Major Cold' },
];

/** The 24 Chinese solar terms (jieqi), longitude multiples of 15 deg starting at 315 (Lichun). */
export function solarTermBefore(jd: JulianDay): SolarTerm {
  const lon = sunLongitude(jd);
  // normalizeDegrees always returns [0, 360), so idx is always in 0..23 -
  // the array index is safe, but noUncheckedIndexedAccess can't see that.
  const idx = Math.floor(normalizeDegrees(lon - 315) / 15) % 24;
  const targetDeg = normalizeDegrees(315 + idx * 15);
  const termJd = findSolarLongitudeCrossing(jd, targetDeg, -1);
  const name = SOLAR_TERM_NAMES[idx] as (typeof SOLAR_TERM_NAMES)[number];
  return { index: idx, nameEn: name.en, namePinyin: name.pinyin, nameHan: name.han, jd: termJd };
}

// --- Antikythera back-dial cycles -----------------------------------------

/** The Metonic cycle: 235 synodic months ~ 19 tropical years, to within ~2 hours. */
export const METONIC_MONTHS = 235;
export const METONIC_YEARS = 19;

/** The Callippic cycle: 4 Metonic cycles minus 1 day (76 years, 940 months). */
export const CALLIPPIC_YEARS = 76;
export const CALLIPPIC_MONTHS = 940;

/** The Saros cycle: 223 synodic months (~6585.32 days), after which eclipses recur. */
export const SAROS_MONTHS = 223;
export const SAROS_DAYS = 6585.321;

/** The Exeligmos: 3 Saros cycles (~19756 days), realigning the eclipse to the same time of day. */
export const EXELIGMOS_DAYS = SAROS_DAYS * 3;

// --- Sunrise / sunset (for Roman seasonal hours and local time-of-day) ----

const OBLIQUITY_J2000 = 23.4392911;

/** Mean obliquity of the ecliptic (Meeus 1998, eq. 22.2, degrees). */
function obliquityDeg(t: number): number {
  return OBLIQUITY_J2000 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t;
}

/** Geocentric solar declination (degrees). */
export function solarDeclination(jd: JulianDay): number {
  const t = centuriesSinceJ2000(jd);
  const eps = obliquityDeg(t) * DEG;
  const lambda = sunLongitude(jd) * DEG;
  return Math.asin(Math.sin(eps) * Math.sin(lambda)) / DEG;
}

/**
 * Equation of time (apparent solar time minus mean solar time), in minutes.
 * Meeus (1998) ch. 28, eq. 28.3.
 */
export function equationOfTimeMinutes(jd: JulianDay): number {
  const t = centuriesSinceJ2000(jd);
  const eps = obliquityDeg(t) * DEG;
  const y = Math.tan(eps / 2) ** 2;
  const l0 = normalizeDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t) * DEG;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const m = normalizeDegrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t) * DEG;

  const eq =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return (4 * eq) / DEG; // radians -> degrees -> minutes (4 min/deg)
}

export interface SunTimes {
  sunriseJD: JulianDay;
  transitJD: JulianDay;
  sunsetJD: JulianDay;
  /** True if the location sees no sunrise/sunset this day (polar day/night). */
  circumpolar: boolean;
}

/**
 * Sunrise, solar transit, and sunset for the UTC calendar day containing
 * `jd`, at geographic (`latDeg`, `lonDeg`, east positive). Standard
 * low-precision hour-angle method (equivalent to the NOAA Solar Calculator);
 * ignores refraction variability, elevation, and Delta-T, so treat results
 * as accurate to a few minutes near the present and degrading (the civil day
 * is treated as a constant 86400 SI seconds) over historical timescales.
 */
export function sunTimes(jd: JulianDay, latDeg: number, lonDeg: number): SunTimes {
  const midnightUtc = Math.floor(jd + 0.5) - 0.5;
  const noonUtc = midnightUtc + 0.5;
  const decl = solarDeclination(noonUtc) * DEG;
  const eqtime = equationOfTimeMinutes(noonUtc);
  const transitJD = noonUtc - lonDeg / 360 - eqtime / 1440;

  const latRad = latDeg * DEG;
  const h0 = -0.8333 * DEG; // standard refraction + solar semidiameter
  const cosH =
    (Math.sin(h0) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));

  if (cosH > 1) return { sunriseJD: transitJD, transitJD, sunsetJD: transitJD, circumpolar: true }; // polar night
  if (cosH < -1) return { sunriseJD: transitJD, transitJD, sunsetJD: transitJD, circumpolar: true }; // polar day

  const haDeg = Math.acos(cosH) / DEG;
  return {
    sunriseJD: transitJD - haDeg / 360,
    transitJD,
    sunsetJD: transitJD + haDeg / 360,
    circumpolar: false,
  };
}

export interface CycleProgress {
  /** Which iteration of the cycle we are in, counted from the epoch. */
  cycleNumber: number;
  /** Position within the current cycle, 0-1. */
  fraction: number;
}

/** Position within a repeating cycle of `lengthDays` days, counted from `epochJd`. */
export function cycleProgress(
  jd: JulianDay,
  epochJd: JulianDay,
  lengthDays: number,
): CycleProgress {
  const elapsed = jd - epochJd;
  const cycleNumber = Math.floor(elapsed / lengthDays);
  const fraction = elapsed / lengthDays - cycleNumber;
  return { cycleNumber, fraction };
}
