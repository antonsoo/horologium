import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  babylonian,
  byzantine,
  chinese,
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

const scratch = mkdtempSync(join(tmpdir(), 'horologium-date-inputs-'));
beforeAll(() => {
  writeFileSync(join(scratch, 'package.json'), '{"type":"module"}');
  const compiled = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.lib.json', '--outDir', scratch],
    { encoding: 'utf8', timeout: 30_000 },
  );
  expect(compiled.status, compiled.stdout + compiled.stderr).toBe(0);
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('library date inputs', () => {
  it.each(['coptic.copticFromJD', 'coptic.ethiopianFromJD', 'islamic.fromJD', 'hebrew.fromJD'])(
    '%s rejects unbounded inputs and recovers in the same process',
    (name) => {
      const library = pathToFileURL(join(scratch, 'index.js')).href;
      const code = `
        import * as library from ${JSON.stringify(library)};
        const [namespace, method] = ${JSON.stringify(name)}.split('.');
        console.log('ready');
        for (const value of [Infinity, -Infinity, 1e20, -1e20, Number.MAX_VALUE]) {
          try { library[namespace][method](value); process.exit(2); }
          catch (error) { if (!(error instanceof RangeError)) process.exit(3); }
        }
        const jd = library.core.gregorianToJD(2000, 1, 1);
        const date = library[namespace][method](jd);
        if (!Number.isSafeInteger(date.year) || date.day < 1) process.exit(4);
        console.log('recovered');
      `;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        encoding: 'utf8',
        timeout: 2000,
      });
      expect(child.stdout).toContain('ready');
      expect(child.error, child.stderr).toBeUndefined();
      expect(child.status, child.stderr).toBe(0);
      expect(child.stdout).toContain('recovered');
    },
  );

  it('rejects NaN across the public inverse calendar paths', () => {
    const conversions = [
      core.jdToGregorian,
      core.jdToJulian,
      coptic.copticFromJD,
      coptic.ethiopianFromJD,
      islamic.fromJD,
      hebrew.fromJD,
      egyptian.fromJD,
      zoroastrian.fromJD,
      maya.fromJD,
      maya.longCountFromJD,
      maya.tzolkinFromJD,
      maya.haabFromJD,
      maya.lordOfNightFromJD,
      chinese.chineseFromJD,
      greek.atticFromJD,
      greek.olympiadFromJD,
      babylonian.fromJD,
      byzantine.fromJD,
      roman.fromJD,
    ];
    for (const convert of conversions) expect(() => convert(NaN)).toThrow(RangeError);
  });

  it('rejects invalid Dates and unsupported Date instants instead of returning Invalid Date', () => {
    expect(() => core.dateToJD(new Date('invalid'))).toThrow(RangeError);
    expect(() => core.jdToDate(1e20)).toThrow(RangeError);
    const leapDay = new Date('2024-02-29T12:34:56.789Z');
    expect(core.jdToDate(core.dateToJD(leapDay)).getTime()).toBe(leapDay.getTime());
  });

  it('rejects unsafe day counts, civil-date fields and molad part arithmetic', () => {
    for (const jd of [1e20, -1e20, Number.MAX_VALUE]) {
      for (const convert of [
        core.jdToGregorian,
        core.jdToJulian,
        maya.fromJD,
        egyptian.fromJD,
        zoroastrian.fromJD,
      ])
        expect(() => convert(jd)).toThrow(RangeError);
    }
    expect(() => maya.fromJD(2451545, Infinity)).toThrow(RangeError);
    expect(() => maya.fromJD(Number.MAX_VALUE, -Number.MAX_VALUE)).toThrow(RangeError);
    expect(() => hebrew.moladTishrei(1e9)).toThrow(RangeError);
    expect(() => hebrew.moladTishrei(1.5)).toThrow(RangeError);
  });
});
