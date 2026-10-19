/**
 * Approximate geocentric ecliptic longitudes of the five naked-eye planets,
 * for the Antikythera dial's planet pointers.
 *
 * Elements and rates: JPL/Caltech, "Approximate Positions of the Planets",
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html. Table 1 covers 1800-2050
 * CE; Tables 2a/2b cover 3000 BCE-3000 CE. planetPositions selects the fit
 * appropriate to the supplied date. Outside both intervals it extrapolates
 * Table 2 and explicitly reports inRange: false.
 * Standish's nominal error table describes heliocentric coordinates, not the
 * geocentric dial. Our measured geocentric errors are retained in the study.
 *
 * Method: mean elements -> mean anomaly -> Kepler's equation (Newton's
 * method) -> heliocentric position in the orbital plane -> rotate by
 * (argument of perihelion, inclination, longitude of ascending node) into
 * J2000 ecliptic coordinates -> subtract Earth's own heliocentric position
 * (from the Earth-Moon barycenter's elements) to get a geocentric vector,
 * then precess the complete geocentric vector to the mean ecliptic and equinox
 * of date before taking its longitude. The dial's tropical zodiac is referenced
 * to that moving equinox, not J2000. See precession.ts and studies/planet-frame.
 * These are geometric positions: light-time, aberration and nutation are not
 * included. The caller's Julian day is used directly as the dynamical argument;
 * no UTC-to-TT conversion is made for these illustrative pointers.
 */

import { gregorianToJD, type JulianDay } from '../core/jd.js';
import { checkJulianDay } from '../core/validation.js';
import { eclipticOfDate } from './precession.js';

const DEG = Math.PI / 180;

interface OrbitalElements {
  name: string;
  a0: number;
  aDot: number;
  e0: number;
  eDot: number;
  i0: number;
  iDot: number;
  l0: number;
  lDot: number;
  peri0: number;
  periDot: number;
  node0: number;
  nodeDot: number;
  /** Table 2b mean-anomaly terms; b, c, s in degrees, f in degrees/century. */
  correction?: readonly [b: number, c: number, s: number, f: number];
}

// Table 1, Standish (1800 AD - 2050 AD). Units: a in AU/AU-per-century, all
// angles in degrees/degrees-per-century.
export const PLANETS: OrbitalElements[] = [
  {
    name: 'Mercury',
    a0: 0.38709927,
    aDot: 0.00000037,
    e0: 0.20563593,
    eDot: 0.00001906,
    i0: 7.00497902,
    iDot: -0.00594749,
    l0: 252.2503235,
    lDot: 149472.67411175,
    peri0: 77.45779628,
    periDot: 0.16047689,
    node0: 48.33076593,
    nodeDot: -0.12534081,
  },
  {
    name: 'Venus',
    a0: 0.72333566,
    aDot: 0.0000039,
    e0: 0.00677672,
    eDot: -0.00004107,
    i0: 3.39467605,
    iDot: -0.0007889,
    l0: 181.9790995,
    lDot: 58517.81538729,
    peri0: 131.60246718,
    periDot: 0.00268329,
    node0: 76.67984255,
    nodeDot: -0.27769418,
  },
  {
    name: 'Mars',
    a0: 1.52371034,
    aDot: 0.00001847,
    e0: 0.0933941,
    eDot: 0.00007882,
    i0: 1.84969142,
    iDot: -0.00813131,
    l0: -4.55343205,
    lDot: 19140.30268499,
    peri0: -23.94362959,
    periDot: 0.44441088,
    node0: 49.55953891,
    nodeDot: -0.29257343,
  },
  {
    name: 'Jupiter',
    a0: 5.202887,
    aDot: -0.00011607,
    e0: 0.04838624,
    eDot: -0.00013253,
    i0: 1.30439695,
    iDot: -0.00183714,
    l0: 34.39644051,
    lDot: 3034.74612775,
    peri0: 14.72847983,
    periDot: 0.21252668,
    node0: 100.47390909,
    nodeDot: 0.20469106,
  },
  {
    name: 'Saturn',
    a0: 9.53667594,
    aDot: -0.0012506,
    e0: 0.05386179,
    eDot: -0.00050991,
    i0: 2.48599187,
    iDot: 0.00193609,
    l0: 49.95424423,
    lDot: 1222.49362201,
    peri0: 92.59887831,
    periDot: -0.41897216,
    node0: 113.66242448,
    nodeDot: -0.28867794,
  },
];

/** Earth-Moon barycenter elements, same table, used to get Earth's heliocentric position. */
const EARTH: OrbitalElements = {
  name: 'Earth',
  a0: 1.00000261,
  aDot: 0.00000562,
  e0: 0.01671123,
  eDot: -0.00004392,
  i0: -0.00001531,
  iDot: -0.01294668,
  l0: 100.46457166,
  lDot: 35999.37244981,
  peri0: 102.93768193,
  periDot: 0.32327364,
  node0: 0,
  nodeDot: 0,
};

// Tables 2a and 2b. Each tuple follows the source columns a, e, I, L, peri, node.
// The Earth-Moon barycenter must use the same fit as the planet being subtracted.
function longElements(
  name: string,
  base: readonly [number, number, number, number, number, number],
  rates: readonly [number, number, number, number, number, number],
  correction?: OrbitalElements['correction'],
): OrbitalElements {
  return {
    name,
    a0: base[0],
    aDot: rates[0],
    e0: base[1],
    eDot: rates[1],
    i0: base[2],
    iDot: rates[2],
    l0: base[3],
    lDot: rates[3],
    peri0: base[4],
    periDot: rates[4],
    node0: base[5],
    nodeDot: rates[5],
    ...(correction ? { correction } : {}),
  };
}

const LONG_PLANETS: OrbitalElements[] = [
  longElements(
    'Mercury',
    [0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895, 48.33961819],
    [0.0, 2.123e-5, -0.00590158, 149472.67486623, 0.15940013, -0.12214182],
  ),
  longElements(
    'Venus',
    [0.72332102, 0.00676399, 3.39777545, 181.9797085, 131.76755713, 76.67261496],
    [-2.6e-7, -5.107e-5, 0.00043494, 58517.8156026, 0.05679648, -0.27274174],
  ),
  longElements(
    'Mars',
    [1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784, 49.71320984],
    [9.7e-7, 9.149e-5, -0.00724757, 19140.29934243, 0.45223625, -0.26852431],
  ),
  longElements(
    'Jupiter',
    [5.20248019, 0.0485359, 1.29861416, 34.33479152, 14.27495244, 100.29282654],
    [-2.864e-5, 0.00018026, -0.00322699, 3034.90371757, 0.18199196, 0.13024619],
    [-0.00012452, 0.0606406, -0.35635438, 38.35125],
  ),
  longElements(
    'Saturn',
    [9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063, 113.63998702],
    [-3.065e-5, -0.00032044, 0.00451969, 1222.11494724, 0.54179478, -0.25015002],
    [0.00025899, -0.13434469, 0.87320147, 38.35125],
  ),
];

const LONG_EARTH = longElements(
  'Earth',
  [1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885, -5.11260389],
  [-3e-8, -3.661e-5, -0.01337178, 35999.37306329, 0.3179526, -0.24123856],
);

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Heliocentric ecliptic (x, y, z) in AU, J2000 frame, for one body's elements at time T (Julian centuries since J2000). */
function heliocentricPosition(el: OrbitalElements, t: number): [number, number, number] {
  const a = el.a0 + el.aDot * t;
  const e = el.e0 + el.eDot * t;
  const i = (el.i0 + el.iDot * t) * DEG;
  const l = el.l0 + el.lDot * t;
  const peri = el.peri0 + el.periDot * t;
  const node = el.node0 + el.nodeDot * t;
  const omega = (peri - node) * DEG; // argument of perihelion
  const nodeRad = node * DEG;

  const correction = el.correction;
  const anomaly = correction
    ? l -
      peri +
      correction[0] * t * t +
      correction[1] * Math.cos(correction[3] * t * DEG) +
      correction[2] * Math.sin(correction[3] * t * DEG)
    : l - peri;
  const mDeg = normalizeDeg(anomaly);
  const m = mDeg * DEG;

  // Kepler's equation, Newton's method (converges in a handful of steps for e < ~0.2).
  let eAnom = m + e * Math.sin(m);
  for (let iter = 0; iter < 10; iter++) {
    const delta = (eAnom - e * Math.sin(eAnom) - m) / (1 - e * Math.cos(eAnom));
    eAnom -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }

  const xOrb = a * (Math.cos(eAnom) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(eAnom);

  const cosO = Math.cos(omega);
  const sinO = Math.sin(omega);
  const cosN = Math.cos(nodeRad);
  const sinN = Math.sin(nodeRad);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const x = (cosO * cosN - sinO * sinN * cosI) * xOrb + (-sinO * cosN - cosO * sinN * cosI) * yOrb;
  const y = (cosO * sinN + sinO * cosN * cosI) * xOrb + (-sinO * sinN + cosO * cosN * cosI) * yOrb;
  const z = sinO * sinI * xOrb + cosO * sinI * yOrb;
  return [x, y, z];
}

/** Legacy explicit-element helper, always subtracting Table 1 Earth.
 * PLANETS + planetLongitude retain their original Table 1 behavior.
 * Use planetPositions for date-dependent selection and fit coverage metadata.
 */
export function planetLongitude(planet: OrbitalElements, jd: JulianDay): number {
  return geocentricLongitude(planet, EARTH, jd);
}

function geocentricLongitude(
  planet: OrbitalElements,
  earth: OrbitalElements,
  jd: JulianDay,
): number {
  const t = (jd - 2451545.0) / 36525;
  const [px, py, pz] = heliocentricPosition(planet, t);
  const [ex, ey, ez] = heliocentricPosition(earth, t);
  const [gx, gy] = eclipticOfDate([px - ex, py - ey, pz - ez], t);
  const lon = (Math.atan2(gy, gx) / DEG) % 360;
  return lon < 0 ? lon + 360 : lon;
}

export interface PlanetModel {
  id: 'jpl-1800-2050' | 'jpl-3000bce-3000ce';
  /** Inclusive bounds, at January 1 midnight in the proleptic Gregorian calendar. */
  fromJD: JulianDay;
  toJD: JulianDay;
  /** Fit coverage only; not a guarantee of geocentric or apparent-place accuracy. */
  inRange: boolean;
}

const MODERN_FROM = gregorianToJD(1800, 1, 1);
const MODERN_TO = gregorianToJD(2050, 1, 1);
const LONG_FROM = gregorianToJD(-2999, 1, 1); // 3000 BCE, astronomical year numbering
const LONG_TO = gregorianToJD(3000, 1, 1);

/** Select a published fit; the modern fit keeps its established precision. */
export function planetModel(jd: JulianDay): PlanetModel {
  checkJulianDay(jd);
  if (jd >= MODERN_FROM && jd <= MODERN_TO) {
    return { id: 'jpl-1800-2050', fromJD: MODERN_FROM, toJD: MODERN_TO, inRange: true };
  }
  return {
    id: 'jpl-3000bce-3000ce',
    fromJD: LONG_FROM,
    toJD: LONG_TO,
    inRange: jd >= LONG_FROM && jd <= LONG_TO,
  };
}

/** Five geometric longitudes, mean ecliptic/equinox of date, with fit provenance.
 * The nominal JD is used as JDTDB; no civil-time conversion is performed.
 * Positions outside model coverage remain illustrative extrapolations.
 */
export function planetPositions(jd: JulianDay): {
  model: PlanetModel;
  positions: { name: string; longitudeDeg: number }[];
} {
  const model = planetModel(jd);
  const modern = model.id === 'jpl-1800-2050';
  return {
    model,
    positions: (modern ? PLANETS : LONG_PLANETS).map((p) => {
      const longitudeDeg = geocentricLongitude(p, modern ? EARTH : LONG_EARTH, jd);
      if (!Number.isFinite(longitudeDeg)) {
        throw new RangeError('Planet position exceeds usable Keplerian arithmetic.');
      }
      return { name: p.name, longitudeDeg };
    }),
  };
}
