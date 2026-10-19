/**
 * Low-precision Sun and Moon ecliptic positions, phase, and the Metonic /
 * Callippic / Saros / Exeligmos eclipse-and-calendar cycles used by the
 * Antikythera mechanism's back dials.
 *
 * Formulas follow Jean Meeus, *Astronomical Algorithms*, 2nd ed.
 * (Willmann-Bell, 1998):
 *  - Sun: ch. 25, "Solar Coordinates" (low-precision mean elements and
 *    equation of center, with the apparent-longitude correction).
 *  - Moon: ch. 47's full longitude series and additive terms, with the
 *    eccentricity factors and complete argument polynomials. The old ten-term
 *    table contained wrong signs and arguments, not just truncation error.
 *    See moon-longitude.ts and studies/lunar-series for JPL comparisons.
 *
 * These illustrative functions use the supplied Julian day directly as their
 * dynamical argument; they do not convert UT to TT. Moon longitude is relative
 * to the mean equinox of date; the Sun includes its low-precision apparent
 * correction. Lunar age and the Greek/Babylonian reconstructions root-find this
 * approximate elongation. The Chinese calendar has separate event formulas in
 * calendar-events.ts, including its own estimate of TT minus UT.
 */

import type { JulianDay } from '../core/jd.js';
import { moonLongitude } from './moon-longitude.js';

export { moonLongitude };

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

/** Approximate ecliptic elongation, degrees, used for phase; see the time/frame limits above. */
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
  // Age is zero at a crossing; the public previousNewMoon search is strict.
  const lastNew = findElongationCrossing(jd, -1);
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
 * The adjacent floating-point instant before `jd`, without shifting the
 * requested interval by an arbitrary number of seconds or minutes.
 */
function previousInstant(jd: JulianDay): JulianDay {
  if (jd === 0) return -Number.MIN_VALUE;
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, jd);
  bits.setBigUint64(0, bits.getBigUint64(0) + (jd > 0 ? -1n : 1n));
  return bits.getFloat64(0);
}

/** Inclusive search for the nearest modeled new moon in the given direction.
 * Return the first representable JD on the nonnegative side of the crossing.
 * This makes a returned event reusable as an inclusive search boundary.
 */
function findElongationCrossing(jd: JulianDay, direction: -1 | 1): JulianDay {
  if (!Number.isFinite(jd)) throw new RangeError('Julian Day must be finite.');
  const f = (x: JulianDay) => {
    const e = moonElongation(x);
    return ((((e + 180) % 360) + 360) % 360) - 180;
  };
  const phase = f(jd);
  const before = f(previousInstant(jd));
  if (before < 0 && phase >= 0 && phase - before < 180) return jd;

  // Coarse step in the requested direction until the sign flips.
  const step = direction * (SYNODIC_MONTH / 24); // ~1.23 days, safely under half a lunation
  let a = jd;
  let fa = phase;
  for (let i = 0; i < 40; i++) {
    const b = a + step;
    const fb = f(b);
    let lo = Math.min(a, b);
    let hi = Math.max(a, b);
    const flo = direction === 1 ? fa : fb;
    const fhi = direction === 1 ? fb : fa;
    // The full-moon wrap also changes sign, but in the opposite direction.
    if (flo < 0 && fhi >= 0 && fhi - flo < 180) {
      for (let j = 0; j < 64; j++) {
        const mid = (lo + hi) / 2;
        if (mid === lo || mid === hi) return hi;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      return hi;
    }
    a = b;
    fa = fb;
  }
  throw new RangeError('Could not bracket a new moon near this Julian Day.');
}

/** JD of the new moon (elongation 0) immediately before `jd`. */
export function previousNewMoon(jd: JulianDay): JulianDay {
  return findElongationCrossing(previousInstant(jd), -1);
}

/** JD of the new moon (elongation 0) immediately at or after `jd`. */
export function nextNewMoon(jd: JulianDay): JulianDay {
  return findElongationCrossing(jd, 1);
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
  /** True if either boundary is absent or uncertain. Missing boundaries use transitJD here;
   * prefer solarDayEvents for individually nullable sunrise/sunset values. */
  circumpolar: boolean;
}

export interface SolarDayEvents {
  /** Upper meridian transit for the solar day labelled by the input's UTC date.
   * At longitudes near the date line this can fall on a neighboring UTC date. */
  transitJD: JulianDay;
  /** Lower-altitude boundaries enclosing this day's upper culmination. */
  cycleStartJD: JulianDay;
  cycleEndJD: JulianDay;
  sunriseJD: JulianDay | null;
  sunsetJD: JulianDay | null;
  /** Grazing events are withheld: a daily extremum lies within the nominal
   * low-precision solar model's 0.02-degree horizon band. This is not a
   * statistical confidence interval or a weather/ancient-time error bound. */
  sunriseStatus: 'crossing' | 'absent' | 'grazing';
  sunsetStatus: 'crossing' | 'absent' | 'grazing';
}

/** Find a daily altitude extremum without assuming it occurs at meridian
 * transit. Near the poles, changing declination shifts the maximum/minimum. */
function altitudeExtremum(
  altitude: (jd: number) => number,
  start: number,
  end: number,
  maximum: boolean,
): number {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = start;
  let b = end;
  let x = b - ratio * (b - a);
  let y = a + ratio * (b - a);
  let fx = altitude(x);
  let fy = altitude(y);
  for (let i = 0; i < 48 && b - a > 1e-8; i++) {
    if (fx < fy === maximum) {
      a = x;
      x = y;
      fx = fy;
      y = a + ratio * (b - a);
      fy = altitude(y);
    } else {
      b = y;
      y = x;
      fy = fx;
      x = b - ratio * (b - a);
      fx = altitude(x);
    }
  }
  return (a + b) / 2;
}

/** Model sunrise and sunset independently, including one-sided polar-season
 * transitions. Reevaluate the Sun throughout each event search instead of
 * freezing its declination at UTC noon. Fixed -0.8333 degree topocentric
 * center altitude represents nominal refraction and semidiameter. Elevation,
 * weather and Delta-T are not modeled; grazing events are especially sensitive
 * to the low-precision solar series. These are model crossings, not observations. */
export function solarDayEvents(jd: JulianDay, latDeg: number, lonDeg: number): SolarDayEvents {
  if (
    ![jd, latDeg, lonDeg].every(Number.isFinite) ||
    Math.abs(latDeg) > 90 ||
    Math.abs(lonDeg) > 180
  )
    throw new RangeError(
      'Solar events require a finite Julian day, latitude -90..90 and longitude -180..180.',
    );
  const meanNoon = Math.floor(jd + 0.5) - lonDeg / 360;
  let transitJD = meanNoon;
  for (let i = 0; i < 5; i++) transitJD = meanNoon - equationOfTimeMinutes(transitJD) / 1440;
  if (!Number.isFinite(transitJD) || transitJD - 0.75 === transitJD)
    throw new RangeError('Julian day exceeds the numeric range of the solar event model.');
  const sinLat = Math.sin(latDeg * DEG);
  const cosLat = Math.cos(latDeg * DEG);
  const altitude = (time: number): number => {
    const dec = solarDeclination(time) * DEG;
    const h = (((time + 0.5) % 1) * 360 + lonDeg + equationOfTimeMinutes(time) / 4 - 180) * DEG;
    const sinAlt = Math.max(
      -1,
      Math.min(1, sinLat * Math.sin(dec) + cosLat * Math.cos(dec) * Math.cos(h)),
    );
    // Leading-order solar parallax at 1 AU; the annual distance variation is
    // smaller than this low-precision model's angular error.
    return Math.asin(sinAlt) / DEG - (8.794 / 3600) * Math.sqrt(1 - sinAlt * sinAlt);
  };
  const peak = altitudeExtremum(altitude, transitJD - 0.25, transitJD + 0.25, true);
  const cycleStartJD = altitudeExtremum(altitude, peak - 0.75, peak - 0.25, false);
  const cycleEndJD = altitudeExtremum(altitude, peak + 0.25, peak + 0.75, false);
  const horizon = -0.8333;
  const peakAltitude = altitude(peak);
  const beforeAltitude = altitude(cycleStartJD);
  const afterAltitude = altitude(cycleEndJD);
  const peakAbove = peakAltitude > horizon;
  const grazingBand = 0.02;
  const peakGrazes = Math.abs(peakAltitude - horizon) <= grazingBand;
  const sunriseGrazes = peakGrazes || Math.abs(beforeAltitude - horizon) <= grazingBand;
  const sunsetGrazes = peakGrazes || Math.abs(afterAltitude - horizon) <= grazingBand;
  const hasSunrise = peakAbove && beforeAltitude < horizon;
  const hasSunset = peakAbove && afterAltitude < horizon;
  function crossing(start: number, end: number, rising: boolean): number {
    let a = start;
    let b = end;
    for (let i = 0; i < 40 && b - a > 1e-8; i++) {
      const mid = (a + b) / 2;
      if (altitude(mid) > horizon === rising) b = mid;
      else a = mid;
    }
    return (a + b) / 2;
  }
  return {
    transitJD,
    cycleStartJD,
    cycleEndJD,
    sunriseJD: hasSunrise && !sunriseGrazes ? crossing(cycleStartJD, peak, true) : null,
    sunsetJD: hasSunset && !sunsetGrazes ? crossing(peak, cycleEndJD, false) : null,
    sunriseStatus: sunriseGrazes ? 'grazing' : hasSunrise ? 'crossing' : 'absent',
    sunsetStatus: sunsetGrazes ? 'grazing' : hasSunset ? 'crossing' : 'absent',
  };
}

/** Compatibility shape for existing consumers. An absent/uncertain event retains the
 * historical transit placeholder and sets circumpolar; use solarDayEvents to
 * distinguish individual missing boundaries. */
export function sunTimes(jd: JulianDay, latDeg: number, lonDeg: number): SunTimes {
  const day = solarDayEvents(jd, latDeg, lonDeg);
  return {
    transitJD: day.transitJD,
    sunriseJD: day.sunriseJD ?? day.transitJD,
    sunsetJD: day.sunsetJD ?? day.transitJD,
    circumpolar: day.sunriseJD === null || day.sunsetJD === null,
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
