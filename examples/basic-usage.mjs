// Basic usage of the horologium library.
//
// Run from the repo root:
//   npm run build:lib
//   node examples/basic-usage.mjs
//
// (Or, once published, `npm install github:antonsoo/horologium` and
// `import { ... } from 'horologium'` instead of the relative path below.)

import { chinese, core, egyptian, greek, hebrew, maya, roman } from '../dist/lib/index.js';

const now = core.dateToJD(new Date());
console.log('Julian Day right now:', now.toFixed(5));
console.log();

// Any date works, including deep BCE (astronomical year numbering: 44 BCE = year -43).
const ides = core.julianToJD(-43, 3, 15); // the Roman calendar is Julian, not Gregorian
console.log('The Ides of March, 44 BCE:');
console.log(' ', roman.describe(ides).summary);
console.log(' ', hebrew.describe(ides).transliteration);
console.log(' ', greek.describe(ides).transliteration);
console.log();

const maya2012 = core.gregorianToJD(2012, 12, 21);
console.log('21 December 2012 (the famous Maya "end date"):');
console.log(' ', maya.describe(maya2012).summary);
console.log();

console.log('Today, in a few other calendars:');
console.log(' ', egyptian.describe(now).summary);
console.log(' ', chinese.describe(now).summary);
