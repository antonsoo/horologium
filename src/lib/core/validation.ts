/** Shared inverse-calendar checks; kept outside the public core namespace. */
export function checkJulianDay(jd: number): void {
  if (!Number.isFinite(jd)) throw new RangeError('Julian Day must be a finite number.');
}

export function checkElapsedDays(days: number): void {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError('Elapsed calendar days exceed safe integer arithmetic.');
  }
}

/** The cycle-based estimates are close to the true year. Bound their correction
 * and verify its boundaries: year++ can stop advancing at large magnitudes,
 * and floating-point arithmetic can lose a half-day or change a year's length.
 * Such an input cannot establish a calendar date, even though it may be finite.
 */
export function bracketYear(
  jd: number,
  estimate: number,
  startOfYear: (year: number) => number,
  lengths: readonly number[],
): number {
  checkJulianDay(jd);
  let year = estimate;
  for (let correction = 0; correction < 8; correction++) {
    if (!Number.isSafeInteger(year) || !Number.isSafeInteger(year + 1)) break;
    const start = startOfYear(year);
    const end = startOfYear(year + 1);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start - Math.floor(start) !== 0.5 ||
      end - Math.floor(end) !== 0.5 ||
      !lengths.includes(end - start)
    )
      break;
    if (jd < start) year--;
    else if (jd >= end) year++;
    else return year;
  }
  throw new RangeError('Cannot determine a calendar year with reliable integer-day arithmetic.');
}
