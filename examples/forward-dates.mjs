// Run after npm run build:lib, or in a consumer of the built package.
import { coptic, core, hebrew, islamic } from '@antonsoloviev/horologium';

const cases = [
  ['Gregorian 2025-02-29', () => core.gregorianToJD(2025, 2, 29)],
  ['Julian 1900-02-30', () => core.julianToJD(1900, 2, 30)],
  ['Hebrew 5784, Cheshvan 30', () => hebrew.toJD({ year: 5784, month: 8, day: 30 })],
  ['Coptic 1740, month 13 day 6', () => coptic.copticToJD({ year: 1740, month: 13, day: 6 })],
  ['Islamic 1445, Safar 30', () => islamic.toJD({ year: 1445, month: 2, day: 30 })],
];
for (const [label, convert] of cases) {
  try {
    console.log(`${label}: unexpectedly accepted JD ${convert()}`);
    process.exitCode = 1;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    console.log(`${label}: ${error.name}`);
  }
}
const valid = core.gregorianToJD(2024, 2, 29.5);
console.log(`Valid leap day at noon: JD ${valid}`);
console.log(`Recovered date: ${JSON.stringify(core.jdToGregorian(valid))}`);
