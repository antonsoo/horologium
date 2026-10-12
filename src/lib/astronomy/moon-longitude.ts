/**
 * Meeus (1998), chapter 47: longitude relative to the mean equinox of date.
 * Longitude terms/arguments adapted from Sonia Keys / Commenthol, astronomia:
 * https://github.com/commenthol/astronomia/blob/71e16c942b143a1a5a067b6aab2d8532064704ae/src/moonposition.js
 * MIT; see THIRD_PARTY_NOTICES.md. Latitude and distance series are not included.
 */
import type { JulianDay } from '../core/jd.js';

const DEG = Math.PI / 180;
const radians = (degrees: number) => (degrees % 360) * DEG;

// Multipliers of D, M, M', F, followed by sine amplitude in millionths of a
// degree. Table 47.A has 60 rows; its final row contributes only to distance.
const LONGITUDE_TERMS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595],
  [4, -1, -1, 0, 1215],
  [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713],
  [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596],
  [4, 0, 1, 0, 549],
  [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520],
  [1, 0, -2, 0, -487],
  [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351],
  [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330],
  [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299],
  [2, 0, 3, 0, 294],
];

/**
 * Mean-equinox lunar longitude, 0-360 degrees. The argument is used directly
 * as a dynamical Julian day, matching the existing illustrative Sun/Moon API.
 * No UT-to-TT conversion or nutation is applied; see studies/lunar-series for
 * separate model-time and actual UTC-clock comparisons and their limits.
 */
export function moonLongitude(jd: JulianDay): number {
  const t = (jd - 2451545) / 36525;
  const lp =
    218.3164477 + t * (481267.88123421 + t * (-0.0015786 + t * (1 / 538841 - t / 65194000)));
  const d = radians(
    297.8501921 + t * (445267.1114034 + t * (-0.0018819 + t * (1 / 545868 - t / 113065000))),
  );
  const m = radians(357.5291092 + t * (35999.0502909 + t * (-0.0001536 + t / 24490000)));
  const mp = radians(
    134.9633964 + t * (477198.8675055 + t * (0.0087414 + t * (1 / 69699 - t / 14712000))),
  );
  const f = radians(
    93.272095 + t * (483202.0175233 + t * (-0.0036539 + t * (-1 / 3526000 + t / 863310000))),
  );
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  const e2 = e * e;
  const lpRad = radians(lp);
  let sum =
    3958 * Math.sin(radians(119.75 + 131.849 * t)) +
    1962 * Math.sin(lpRad - f) +
    318 * Math.sin(radians(53.09 + 479264.29 * t));
  for (const [nd, nm, nmp, nf, amplitude] of LONGITUDE_TERMS) {
    // Terms involving the Sun's anomaly scale with Earth's eccentricity.
    const factor = nm === 0 ? 1 : Math.abs(nm) === 1 ? e : e2;
    sum += amplitude * factor * Math.sin(nd * d + nm * m + nmp * mp + nf * f);
  }
  const longitude = (lp + sum / 1e6) % 360;
  return longitude < 0 ? longitude + 360 : longitude;
}
