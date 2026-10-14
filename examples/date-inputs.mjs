// Source checkout: npm run build:lib && node examples/date-inputs.mjs
// Uses the package's public export; inputs below are deliberately invalid.
import { coptic, core, hebrew, islamic, maya } from '@antonsoloviev/horologium';

console.log('Calendar input errors (source correction, unreleased)');
for (const [label, calculate] of [
  ['Invalid JavaScript Date', () => core.dateToJD(new Date('invalid'))],
  ['Coptic / Infinity', () => coptic.copticFromJD(Infinity)],
  ['Islamic / finite 1e20', () => islamic.fromJD(1e20)],
  ['Hebrew / NaN', () => hebrew.fromJD(NaN)],
  ['Maya / invalid correlation', () => maya.fromJD(2451545, Infinity)],
]) {
  try {
    calculate();
    throw new Error(`${label}: expected a refused input`);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    console.log(`${label}: ${error.name}: ${error.message}`);
  }
}
console.log('Recovery in the same process:');
console.log(coptic.describeCoptic(core.gregorianToJD(2000, 1, 1)).native);
console.log(hebrew.describe(core.gregorianToJD(2000, 1, 1)).transliteration);
