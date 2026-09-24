import { describe, expect, it } from 'vitest';
import { gregorianToJD } from '../src/lib/core/jd.js';
import {
  fromJD,
  GMT_CORRELATION_STANDARD,
  haabFromJD,
  jdFromLongCount,
  longCountFromJD,
  mayaNumeralSVG,
  toJD,
  tzolkinFromJD,
} from '../src/lib/maya.js';

describe('Maya calendar: canonical checks', () => {
  it("13.0.0.0.0 = 4 Ajaw 3 K'ank'in = 21 December 2012 (Gregorian), GMT correlation 584283", () => {
    const jd = gregorianToJD(2012, 12, 21);
    const longCount = longCountFromJD(jd, GMT_CORRELATION_STANDARD);
    expect(longCount).toEqual({ baktun: 13, katun: 0, tun: 0, winal: 0, kin: 0 });

    const tzolkin = tzolkinFromJD(jd);
    expect(`${tzolkin.number} ${tzolkin.name}`).toBe('4 Ajaw');

    const haab = haabFromJD(jd);
    expect(`${haab.day} ${haab.month}`).toBe("3 K'ank'in");
  });

  it("0.0.0.0.0 (the creation date) = 4 Ajaw 8 Kumk'u", () => {
    const epochJD = jdFromLongCount({ baktun: 0, katun: 0, tun: 0, winal: 0, kin: 0 });
    const tzolkin = tzolkinFromJD(epochJD);
    expect(`${tzolkin.number} ${tzolkin.name}`).toBe('4 Ajaw');

    const haab = haabFromJD(epochJD);
    expect(`${haab.day} ${haab.month}`).toBe("8 Kumk'u");
  });
});

describe("Maya calendar: Tzolk'in / Haab' periodicity", () => {
  it("Tzolk'in repeats every 260 days", () => {
    const jd = gregorianToJD(2024, 6, 15);
    const a = tzolkinFromJD(jd);
    const b = tzolkinFromJD(jd + 260);
    expect(b).toEqual(a);
  });

  it("Haab' repeats every 365 days", () => {
    const jd = gregorianToJD(2024, 6, 15);
    const a = haabFromJD(jd);
    const b = haabFromJD(jd + 365);
    expect(b).toEqual(a);
  });

  it("the Calendar Round (Tzolk'in + Haab') repeats every 18980 days (73 Haab' = 52 years)", () => {
    const jd = gregorianToJD(2024, 6, 15);
    const jdLater = jd + 18980;
    expect(tzolkinFromJD(jdLater)).toEqual(tzolkinFromJD(jd));
    expect(haabFromJD(jdLater)).toEqual(haabFromJD(jd));
  });
});

describe('Maya calendar: Long Count round trip', () => {
  it('toJD(fromJD(jd)) === jd across ~200 whole-day JDs spanning ~5000 years either side, both correlations', () => {
    const start = gregorianToJD(-3000, 1, 1);
    const end = gregorianToJD(7000, 1, 1);
    const count = 200;
    for (let i = 0; i < count; i++) {
      const raw = start + ((end - start) * i) / (count - 1);
      const jd = Math.floor(raw) + 0.5;
      const date = fromJD(jd);
      expect(toJD(date)).toBe(jd);

      const dateAlt = fromJD(jd, 584285);
      expect(toJD(dateAlt, 584285)).toBe(jd);
    }
  });
});

describe('mayaNumeralSVG', () => {
  it('returns well-formed SVG for 0 (shell glyph)', () => {
    const svg = mayaNumeralSVG(0);
    expect(svg).toContain('<svg');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
    expect((svg.match(/<\/svg>/g) ?? []).length).toBe(1);
  });

  it('returns well-formed SVG for 13 (2 bars + 3 dots)', () => {
    const svg = mayaNumeralSVG(13, { size: 80 });
    expect(svg).toContain('<svg');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  });

  it('returns well-formed SVG for 19 (max value: 3 bars + 4 dots)', () => {
    const svg = mayaNumeralSVG(19);
    expect((svg.match(/<circle/g) ?? []).length).toBe(4);
    expect((svg.match(/<rect/g) ?? []).length).toBe(3);
  });
});
