/**
 * Approximate geocentric ecliptic longitudes of the five naked-eye planets,
 * for the Antikythera dial's planet pointers.
 *
 * Elements and rates are E.M. Standish (JPL/Caltech), "Keplerian Elements
 * for Approximate Positions of the Major Planets", Table 1 ("1800 AD -
 * 2050 AD" low-order fit; see https://ssd.jpl.nasa.gov/planets/approx_pos.html).
 * That table (and this module) is explicitly only valid 1800-2050 CE - well
 * short of this project's ancient date range. Outside that window we still
 * compute a position (the underlying two-body Keplerian propagation is
 * well-defined for any date), but it should be read as illustrative motion
 * only, not a claim of positional accuracy; the UI must label it as such.
 * Within 1800-2050, Standish states accuracy of a few arcminutes for the
 * inner planets and somewhat more for Jupiter/Saturn.
 *
 * Method: mean elements -> mean anomaly -> Kepler's equation (Newton's
 * method) -> heliocentric position in the orbital plane -> rotate by
 * (argument of perihelion, inclination, longitude of ascending node) into
 * J2000 ecliptic coordinates -> subtract Earth's own heliocentric position
 * (from the Earth-Moon barycenter's elements) to get a geocentric vector,
 * whose atan2 gives geocentric ecliptic longitude. This is the standard
 * pipeline described in Standish's paper and in Meeus (1998) ch. 33.
 */

import type { JulianDay } from '../core/jd.js';

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

  const mDeg = normalizeDeg(l - peri);
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

/** Geocentric apparent ecliptic longitude of `planet` (degrees, 0-360). See module docs for accuracy/validity. */
export function planetLongitude(planet: OrbitalElements, jd: JulianDay): number {
  const t = (jd - 2451545.0) / 36525;
  const [px, py] = heliocentricPosition(planet, t);
  const [ex, ey] = heliocentricPosition(EARTH, t);
  const gx = px - ex;
  const gy = py - ey;
  const lon = (Math.atan2(gy, gx) / DEG) % 360;
  return lon < 0 ? lon + 360 : lon;
}
