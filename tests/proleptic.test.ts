import { describe, expect, it } from 'vitest';
import {
  babylonian,
  byzantine,
  coptic,
  core,
  egyptian,
  greek,
  hebrew,
  islamic,
  maya,
  roman,
  zoroastrian,
} from '../src/lib/index.js';
import type { CalendarTablet } from '../src/lib/types.js';

const J = core.julianToJD;

// Each era's first day, and the day before it: the tablet is proleptic exactly before the epoch.
const EPOCHS: Array<[string, (jd: number) => CalendarTablet, number]> = [
  ['roman (Julian reform)', roman.describe, J(-44, 1, 1)],
  ['egyptian (Nabonassar)', egyptian.describe, egyptian.EGYPTIAN_EPOCH_JD],
  ['hebrew (Anno Mundi)', hebrew.describe, hebrew.toJD({ year: 1, month: 7, day: 1 })],
  ['islamic (Hijri)', islamic.describe, islamic.toJD({ year: 1, month: 1, day: 1 })],
  ['coptic (Martyrs)', coptic.describeCoptic, coptic.COPTIC_EPOCH_JD],
  ['ethiopian', coptic.describeEthiopian, coptic.ETHIOPIAN_EPOCH_JD],
  ['zoroastrian (Yazdegerdi)', zoroastrian.describe, zoroastrian.ZOROASTRIAN_EPOCH_JD],
  ['maya (13.0.0.0.0)', (jd) => maya.describe(jd), maya.GMT_CORRELATION_STANDARD],
];

describe('proleptic tablets', () => {
  it.each(EPOCHS)('%s is proleptic only before its epoch', (_name, describeFn, epochJd) => {
    expect(describeFn(epochJd).proleptic).toBeUndefined();
    expect(describeFn(epochJd + 400).proleptic).toBeUndefined();
    expect(describeFn(epochJd - 1).proleptic).toMatch(/\w/);
  });

  it('marks the Seleucid Era before its first Nisannu (reconstructed to within a day or two of the attested epoch)', () => {
    expect(babylonian.describe(babylonian.SELEUCID_EPOCH_JD).proleptic).toBeUndefined();
    expect(babylonian.describe(babylonian.SELEUCID_EPOCH_JD - 30).proleptic).toMatch(/311 BCE/);
  });

  it('marks Olympiads before 776 BCE and the Byzantine era before 5509 BCE', () => {
    expect(greek.describe(J(-775, 8, 1)).proleptic).toBeUndefined();
    expect(greek.describe(J(-776, 8, 1)).proleptic).toMatch(/776 BCE/);
    expect(byzantine.describe(J(-5508, 9, 1)).proleptic).toBeUndefined();
    expect(byzantine.describe(J(-5508, 8, 31)).proleptic).toMatch(/5509 BCE/);
  });

  it('leaves the native Hebrew line without a year numeral before AM 1, instead of an empty one', () => {
    const t = hebrew.describe(J(-4000, 6, 1));
    expect(t.native).not.toMatch(/\s$/);
    expect(t.native.split(' ')).toHaveLength(2);
    expect(t.transliteration).toMatch(/-\d+$/);
  });

  it('adds nothing for a present-day date', () => {
    const today = core.gregorianToJD(2026, 9, 30);
    for (const [, describeFn] of EPOCHS) expect(describeFn(today).proleptic).toBeUndefined();
  });
});
