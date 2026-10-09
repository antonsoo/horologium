/**
 * Event timings for the Chinese calendar, separate from the illustrative
 * Sun/Moon pointers. Meeus, Astronomical Algorithms (1998), ch. 49 supplies
 * the new-moon series. It returns TT, which must be converted to an estimate
 * of UT before assigning an event to a civil day.
 *
 * New-moon coefficients adapted from Sonia Keys / Commenthol's MIT-licensed
 * implementation: https://github.com/commenthol/astronomia/blob/master/src/moonphase.js
 * See THIRD_PARTY_NOTICES.md. All angular arguments below are in degrees
 * before conversion, including the quadratic term in the first correction.
 */
import { type JulianDay, jdToGregorian } from '../core/jd.js';
import { findSolarLongitudeCrossing, sunLongitude } from './sun-moon.js';

const DEG = Math.PI / 180;
const MEAN_MONTH = 29.530588861;
const EPOCH = 2451550.09766;

/** Espenak & Meeus's piecewise estimate of TT - UT, in seconds.
 * https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html
 * Predictions are estimates, especially far from the present; this is not a
 * leap-second table or a claim that future UTC is already known.
 */
export function deltaTSeconds(jd: JulianDay): number {
  const date = jdToGregorian(jd);
  const y = date.year + (date.month - 0.5) / 12;
  const longTerm = -20 + 32 * ((y - 1820) / 100) ** 2;
  if (y < -500 || y >= 2150) return longTerm;
  if (y < 500) {
    const u = y / 100;
    return (
      10583.6 -
      1014.41 * u +
      33.78311 * u ** 2 -
      5.952053 * u ** 3 -
      0.1798452 * u ** 4 +
      0.022174192 * u ** 5 +
      0.0090316521 * u ** 6
    );
  }
  if (y < 1600) {
    const u = (y - 1000) / 100;
    return (
      1574.2 -
      556.01 * u +
      71.23472 * u ** 2 +
      0.319781 * u ** 3 -
      0.8503463 * u ** 4 -
      0.005050998 * u ** 5 +
      0.0083572073 * u ** 6
    );
  }
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    const t = y - 1800;
    return (
      13.72 -
      0.332447 * t +
      0.0068612 * t ** 2 +
      0.0041116 * t ** 3 -
      0.00037436 * t ** 4 +
      0.0000121272 * t ** 5 -
      0.0000001699 * t ** 6 +
      0.000000000875 * t ** 7
    );
  }
  if (y < 1900) {
    const t = y - 1860;
    return (
      7.62 +
      0.5737 * t -
      0.251754 * t ** 2 +
      0.01680668 * t ** 3 -
      0.0004473624 * t ** 4 +
      t ** 5 / 233174
    );
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5
    );
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  return longTerm - 0.5628 * (2150 - y);
}

export function universalToTerrestrial(jd: JulianDay): JulianDay {
  return jd + deltaTSeconds(jd) / 86400;
}

function terrestrialToUniversal(jde: number): JulianDay {
  return jde - deltaTSeconds(jde) / 86400;
}

/** New moon with integer lunation k, where k = 0 is January 2000. */
export function calendarNewMoon(k: number): JulianDay {
  const t = k / 1236.85;
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  const m = (2.5534 + 29.1053567 * k - 0.0000014 * t ** 2 - 0.00000011 * t ** 3) * DEG;
  const mp =
    (201.5643 +
      385.81693528 * k +
      0.0107582 * t ** 2 +
      0.00001238 * t ** 3 -
      0.000000058 * t ** 4) *
    DEG;
  const f =
    (160.7108 +
      390.67050284 * k -
      0.0016118 * t ** 2 -
      0.00000227 * t ** 3 +
      0.000000011 * t ** 4) *
    DEG;
  const omega = (124.7746 - 1.56375588 * k + 0.0020672 * t ** 2 + 0.00000215 * t ** 3) * DEG;
  const sin = Math.sin;
  const correction =
    -0.4072 * sin(mp) +
    0.17241 * e * sin(m) +
    0.01608 * sin(2 * mp) +
    0.01039 * sin(2 * f) +
    0.00739 * e * sin(mp - m) -
    0.00514 * e * sin(mp + m) +
    0.00208 * e * e * sin(2 * m) -
    0.00111 * sin(mp - 2 * f) -
    0.00057 * sin(mp + 2 * f) +
    0.00056 * e * sin(2 * mp + m) -
    0.00042 * sin(3 * mp) +
    0.00042 * e * sin(m + 2 * f) +
    0.00038 * e * sin(m - 2 * f) -
    0.00024 * e * sin(2 * mp - m) -
    0.00017 * sin(omega) -
    0.00007 * sin(mp + 2 * m) +
    0.00004 * sin(2 * mp - 2 * f) +
    0.00004 * sin(3 * m) +
    0.00003 * sin(mp + m - 2 * f) +
    0.00003 * sin(2 * mp + 2 * f) -
    0.00003 * sin(mp + m + 2 * f) +
    0.00003 * sin(mp - m + 2 * f) -
    0.00002 * sin(mp - m - 2 * f) -
    0.00002 * sin(3 * mp + m) +
    0.00002 * sin(4 * mp);
  const additional: ReadonlyArray<readonly [number, number]> = [
    [0.000325, 299.77 + 0.107408 * k - 0.009173 * t * t],
    [0.000165, 251.88 + 0.016321 * k],
    [0.000164, 251.83 + 26.651886 * k],
    [0.000126, 349.42 + 36.412478 * k],
    [0.00011, 84.66 + 18.206239 * k],
    [0.000062, 141.74 + 53.303771 * k],
    [0.00006, 207.14 + 2.453732 * k],
    [0.000056, 154.84 + 7.30686 * k],
    [0.000047, 34.52 + 27.261239 * k],
    [0.000042, 207.19 + 0.121824 * k],
    [0.00004, 291.34 + 1.844379 * k],
    [0.000037, 161.72 + 24.198154 * k],
    [0.000035, 239.56 + 25.513099 * k],
    [0.000023, 331.55 + 3.592518 * k],
  ];
  const mean =
    EPOCH + MEAN_MONTH * k + 0.00015437 * t ** 2 - 0.00000015 * t ** 3 + 0.00000000073 * t ** 4;
  const jde =
    mean + correction + additional.reduce((sum, [a, angle]) => sum + a * sin(angle * DEG), 0);
  return terrestrialToUniversal(jde);
}

/** Lunation of the last new moon strictly before the supplied instant. */
export function lunationBefore(jd: JulianDay): number {
  let k = Math.floor((universalToTerrestrial(jd) - EPOCH) / MEAN_MONTH);
  // The mean phase is less than a lunation away throughout the app's range.
  // Bound the search so malformed inputs never lead to an unbounded loop.
  for (let i = 0; i < 5; i++) {
    if (calendarNewMoon(k) >= jd) k--;
    else if (calendarNewMoon(k + 1) < jd) k++;
    else return k;
  }
  throw new RangeError('Could not bracket a new moon in the supported date range');
}

/** Solar longitude at a UT instant, evaluated in TT. */
export function calendarSunLongitude(jd: JulianDay): number {
  return sunLongitude(universalToTerrestrial(jd));
}

/** First apparent solar-longitude crossing after the supplied UT instant. */
export function calendarSolarCrossing(jd: JulianDay, degrees: number): JulianDay {
  return terrestrialToUniversal(findSolarLongitudeCrossing(universalToTerrestrial(jd), degrees, 1));
}
