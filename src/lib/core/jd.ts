/**
 * Julian Day arithmetic and the proleptic Julian / Gregorian calendars.
 *
 * The Julian Day (JD) is the number of days elapsed since noon UTC on
 * 1 January 4713 BCE (Julian proleptic calendar). Every calendar in this
 * library converts to and from JD, so this module is the load-bearing
 * foundation of the whole package.
 *
 * Algorithms follow Jean Meeus, *Astronomical Algorithms*, 2nd ed.
 * (Willmann-Bell, 1998), chapter 7, "Julian Day", and are extended to the
 * proleptic range (dates before the historical calendar reforms) by always
 * applying the same leap-year rule rather than switching at 1582/8 CE.
 *
 * Year numbering throughout this library is *astronomical*: year 0 is
 * 1 BCE, year -1 is 2 BCE, and so on (there is no year zero in the
 * historical BCE/CE count). Use {@link displayYear} to render a
 * human-facing BCE/CE label.
 */

/** A Julian Day Number, fractional, referenced to UTC noon. */
export type JulianDay = number;

export interface CalendarDate {
  /** Astronomical year numbering: 0 = 1 BCE, -1 = 2 BCE, ... */
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31, may carry a fractional part representing time of day */
  day: number;
}

/** JD of the Unix epoch, 1970-01-01T00:00:00Z. */
export const JD_UNIX_EPOCH = 2440587.5;

/** JD - MJD offset (Modified Julian Day epoch: 1858-11-17T00:00 UTC). */
export const MJD_OFFSET = 2400000.5;

/**
 * Julian Day for a proleptic Gregorian calendar date.
 * Meeus (1998) ch. 7, eq. 7.1, applied for all years (proleptic).
 */
export function gregorianToJD(year: number, month: number, day: number): JulianDay {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/**
 * Julian Day for a proleptic Julian calendar date.
 * Meeus (1998) ch. 7, eq. 7.1, with the Gregorian correction B omitted.
 */
export function julianToJD(year: number, month: number, day: number): JulianDay {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day - 1524.5;
}

/** Inverse of {@link gregorianToJD}: proleptic Gregorian date for a JD. */
export function jdToGregorian(jd: JulianDay): CalendarDate {
  return jdToCalendar(jd, true);
}

/** Inverse of {@link julianToJD}: proleptic Julian date for a JD. */
export function jdToJulian(jd: JulianDay): CalendarDate {
  return jdToCalendar(jd, false);
}

function jdToCalendar(jd: JulianDay, gregorian: boolean): CalendarDate {
  const jdShifted = jd + 0.5;
  const z = Math.floor(jdShifted);
  const f = jdShifted - z;

  let a: number;
  if (gregorian) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  } else {
    a = z;
  }

  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return { year, month, day };
}

/** Modified Julian Day (JD - 2400000.5). */
export function jdToMJD(jd: JulianDay): number {
  return jd - MJD_OFFSET;
}

export function mjdToJD(mjd: number): JulianDay {
  return mjd + MJD_OFFSET;
}

/** JD for a JavaScript `Date` (interpreted in UTC). */
export function dateToJD(date: Date): JulianDay {
  return date.getTime() / 86400000 + JD_UNIX_EPOCH;
}

/** JavaScript `Date` (UTC) for a JD. */
export function jdToDate(jd: JulianDay): Date {
  return new Date((jd - JD_UNIX_EPOCH) * 86400000);
}

/**
 * Day of week for a JD: 0 = Sunday, ..., 6 = Saturday.
 * Meeus (1998) ch. 7. JD 2451545.0 (2000-01-01 12:00 UTC) was a Saturday.
 */
export function jdWeekday(jd: JulianDay): number {
  return Math.floor(jd + 1.5) % 7;
}

/**
 * Render an astronomical year (0 = 1 BCE) as a human BCE/CE label.
 * Astronomical year `y <= 0` maps to BCE year `1 - y`.
 */
export function displayYear(year: number): string {
  return year <= 0 ? `${1 - year} BCE` : `${year} CE`;
}

/** True if the given proleptic Gregorian year is a leap year. */
export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** True if the given proleptic Julian year is a leap year. */
export function isJulianLeapYear(year: number): boolean {
  // Astronomical numbering: year 0 (= 1 BCE) is divisible by 4 and is leap.
  return ((year % 4) + 4) % 4 === 0;
}

/** Floor-division modulo that always returns a result with the sign of `n`. */
export function mod(a: number, n: number): number {
  return a - n * Math.floor(a / n);
}

/**
 * Adjusted remainder used throughout Reingold & Dershowitz: like {@link mod}
 * but returns `n` instead of `0` when `a` is an exact multiple of `n`.
 */
export function amod(a: number, n: number): number {
  return n + mod(a, -n);
}
