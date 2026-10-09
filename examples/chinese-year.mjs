// A computed lunar year, including the civil-day evidence for leap months.
// npm run build:lib && node examples/chinese-year.mjs 2033
// node examples/chinese-year.mjs 2033 --json > lunar-2033.json
import { chinese, core } from '../dist/lib/index.js';

const [yearText = '2033', format] = process.argv.slice(2);
if (!/^-?\d+$/.test(yearText) || (format && format !== '--json') || process.argv.length > 4) {
  console.error('Usage: node examples/chinese-year.mjs [YEAR] [--json]');
  process.exit(1);
}
try {
  const year = chinese.inspectChineseYear(Number(yearText));
  if (format === '--json') console.log(JSON.stringify(year, null, 2));
  else {
    console.log(`Chinese lunar year ${year.yearNumber} | civil days in UTC+8\n`);
    console.log('MONTH    START       DAYS  PRINCIPAL SOLAR TERMS');
    for (const month of year.months) {
      const label = `${month.isLeapMonth ? 'leap ' : ''}${month.month}`.padEnd(7);
      const date = core
        .jdToDate(month.startJD + 1 / 3)
        .toISOString()
        .split('T')[0];
      const terms = month.principalTerms.map((term) => term.name).join(', ') || '(none)';
      console.log(`${label}  ${date}  ${month.days}    ${terms}`);
      if (!month.principalTerms.length) {
        console.log(
          `         ${month.monthsInSolsticeCycle} months in the cycle from month 11 of ${month.solsticeYear}.`,
        );
      }
    }
    console.log(`\n${year.note}`);
    console.log('Event times and solar-term dates are approximate. See docs/chinese-calendar.md.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
