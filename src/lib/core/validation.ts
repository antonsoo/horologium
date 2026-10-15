/** Shared calendar input and arithmetic checks; outside the public core namespace. */
export function checkJulianDay(jd: number): void {
  if (!Number.isFinite(jd)) throw new RangeError('Julian Day must be a finite number.');
}

export function checkElapsedDays(days: number): void {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError('Elapsed calendar days exceed safe integer arithmetic.');
  }
}

/** A supplied date names an existing month; it is not an overflow offset. */
export function checkYearMonth(year: number, month: number, months: number): void {
  if (!Number.isSafeInteger(year)) throw new RangeError('Calendar year must be a safe integer.');
  if (!Number.isInteger(month) || month < 1 || month > months)
    throw new RangeError(`Calendar month must be an integer from 1 to ${months}.`);
}

/** Preserve fractional-day arithmetic while refusing overflow into another month.
 * Evaluate the original formula unchanged. Its whole-day counterpart must still
 * establish an exact midnight; a finite, rounded Julian Day is not sufficient.
 */
export function calendarDayToJD(
  day: number,
  monthLength: number,
  calculate: (day: number) => number,
): number {
  if (!Number.isFinite(day) || day < 1 || day >= monthLength + 1)
    throw new RangeError(`Calendar day must be at least 1 and less than ${monthLength + 1}.`);
  const result = calculate(day);
  const midnight = Number.isInteger(day) ? result : calculate(Math.floor(day));
  if (
    !Number.isFinite(result) ||
    !Number.isSafeInteger(Math.floor(midnight)) ||
    midnight - Math.floor(midnight) !== 0.5 ||
    midnight + 1 - Math.floor(midnight + 1) !== 0.5
  )
    throw new RangeError('Calendar date exceeds reliable integer-day arithmetic.');
  return result;
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
