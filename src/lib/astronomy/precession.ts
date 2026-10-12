/**
 * J2000 mean ecliptic -> mean equator -> mean equator of date -> mean ecliptic
 * of date. P03 angles and obliquity: Capitaine, Wallace & Chapront (2003),
 * A&A 412, 567-586, equations 39-40:
 * https://syrte.obspm.fr/iau2006/aa03_412_P03.pdf
 *
 * This rotates a geometric vector; it adds neither nutation nor apparent-place
 * corrections. The fixed ICRS/J2000 frame bias cancels between the two epochs.
 * See studies/planet-frame for independent ERFA matrix and JPL comparisons.
 */
const ARCSEC = Math.PI / (180 * 3600);
type Vector = readonly [number, number, number];

/** Julian centuries from J2000.0; output retains the input distance. */
export function eclipticOfDate(vector: Vector, t: number): Vector {
  const zeta =
    (2.650545 +
      t *
        (2306.083227 +
          t * (0.2988499 + t * (0.01801828 + t * (-0.000005971 - 0.0000003173 * t))))) *
    ARCSEC;
  const z =
    (-2.650545 +
      t *
        (2306.077181 +
          t * (1.0927348 + t * (0.01826837 + t * (-0.000028596 - 0.0000002904 * t))))) *
    ARCSEC;
  const theta =
    t *
    (2004.191903 + t * (-0.4294934 + t * (-0.04182264 + t * (-0.000007089 - 0.0000001274 * t)))) *
    ARCSEC;
  const eps0 = 84381.406 * ARCSEC;
  const eps =
    (84381.406 +
      t *
        (-46.836769 + t * (-0.0001831 + t * (0.0020034 + t * (-0.000000576 - 0.0000000434 * t))))) *
    ARCSEC;

  const [x, y, z0] = vector;
  // Keep the out-of-plane component: flattening before rotation loses the
  // ecliptic pole's motion, especially for Mercury's inclined orbit.
  const eqY = Math.cos(eps0) * y - Math.sin(eps0) * z0;
  const eqZ = Math.sin(eps0) * y + Math.cos(eps0) * z0;
  const a = Math.sin(zeta) * x + Math.cos(zeta) * eqY;
  const b = Math.cos(zeta) * x - Math.sin(zeta) * eqY;
  const c = Math.cos(theta) * b - Math.sin(theta) * eqZ;
  const d = Math.sin(theta) * b + Math.cos(theta) * eqZ;
  const outX = Math.cos(z) * c - Math.sin(z) * a;
  const outY = Math.sin(z) * c + Math.cos(z) * a;
  return [
    outX,
    Math.cos(eps) * outY + Math.sin(eps) * d,
    -Math.sin(eps) * outY + Math.cos(eps) * d,
  ];
}
