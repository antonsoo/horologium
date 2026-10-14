import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
for (const name of ['--library', '--out', '--label']) assert.ok(args.includes(name));
const libraryURL = pathToFileURL(resolve(option('--library')));
const library = await import(libraryURL.href);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const methods = [
  'core.jdToGregorian',
  'core.jdToJulian',
  'coptic.copticFromJD',
  'coptic.ethiopianFromJD',
  'islamic.fromJD',
  'hebrew.fromJD',
  'egyptian.fromJD',
  'zoroastrian.fromJD',
  'maya.fromJD',
  'maya.longCountFromJD',
  'maya.tzolkinFromJD',
  'maya.haabFromJD',
  'maya.lordOfNightFromJD',
  'chinese.chineseFromJD',
  'greek.atticFromJD',
  'greek.olympiadFromJD',
  'babylonian.fromJD',
  'byzantine.fromJD',
  'roman.fromJD',
];
function invoke(method, ...values) {
  const [namespace, name] = method.split('.');
  assert.equal(typeof library[namespace][name], 'function', method);
  return library[namespace][name](...values);
}
const cases = [];
for (const method of methods)
  for (const value of ['NaN', 'Infinity', '-Infinity']) {
    cases.push({ id: `${method}-${value}`, method, value });
  }
for (const method of [
  'core.jdToGregorian',
  'core.jdToJulian',
  'coptic.copticFromJD',
  'coptic.ethiopianFromJD',
  'islamic.fromJD',
  'hebrew.fromJD',
  'egyptian.fromJD',
  'zoroastrian.fromJD',
  'maya.fromJD',
])
  for (const value of ['1e20', '-1e20', 'Number.MAX_VALUE']) {
    cases.push({ id: `${method}-${value}`, method, value });
  }
cases.push(
  { id: 'invalid-Date', method: 'core.dateToJD', value: "new Date('invalid')" },
  { id: 'unsupported-Date', method: 'core.jdToDate', value: '1e20' },
  { id: 'molad-precision', method: 'hebrew.moladTishrei', value: '1e9' },
  { id: 'molad-noninteger', method: 'hebrew.moladTishrei', value: '1.5' },
  { id: 'invalid-correlation', method: 'maya.fromJD', value: '2451545, Infinity' },
  {
    id: 'overflow-correlation',
    method: 'maya.fromJD',
    value: 'Number.MAX_VALUE, -Number.MAX_VALUE',
  },
);

const invalid = [];
for (const item of cases) {
  const [namespace, method] = item.method.split('.');
  // Only the constants above become source code; no caller-provided expression
  // is evaluated. The marker distinguishes calculation hangs from import failures.
  const code = `
    import * as library from ${JSON.stringify(libraryURL.href)};
    console.log('READY');
    try { console.log(JSON.stringify({status:'returned',value:library.${namespace}.${method}(${item.value})})); }
    catch (error) { console.log(JSON.stringify({status:'threw',name:error.name,message:error.message})); }
    console.log(JSON.stringify({recovery:library.coptic.copticFromJD(2451544.5)}));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    timeout: 1200,
  });
  assert.ok(child.stdout.startsWith('READY\n'), `Import/startup did not complete: ${item.id}`);
  const lines = child.stdout.trim().split('\n');
  const outcome = child.error?.code === 'ETIMEDOUT' ? { status: 'timeout' } : JSON.parse(lines[1]);
  const recovered = lines[2] ? JSON.parse(lines[2]).recovery : null;
  const agrees =
    outcome.status === 'threw' &&
    outcome.name === 'RangeError' &&
    child.status === 0 &&
    recovered?.year === 1716 &&
    recovered.month === 4 &&
    recovered.day === 22;
  invalid.push({
    ...item,
    outcome,
    recovered,
    agrees,
    exitCode: child.status,
    signal: child.signal,
    rawStdout: child.stdout,
    rawStderr: child.stderr,
  });
}

const valid = [];
for (const year of [
  -5000, -4000, -775, -746, -43, -1, 0, 1, 284, 622, 632, 674, 1582, 1900, 1970, 2000, 2024, 2026,
  2033, 2100, 5000,
]) {
  for (const [month, day] of [
    [1, 1],
    [12, 31],
  ]) {
    const jd = library.core.gregorianToJD(year, month, day) + 0.25;
    const native = new Date(0);
    native.setUTCFullYear(year, month - 1, day);
    native.setUTCHours(6, 0, 0, 0);
    assert.equal(library.core.jdToDate(jd).getTime(), native.getTime());
    const outputs = Object.fromEntries(methods.map((method) => [method, invoke(method, jd)]));
    valid.push({ jd, date: [year, month, day, 6], outputs });
  }
}
// Wider arithmetic controls do not call the deliberately range-limited Chinese
// or astronomical reconstructions. Native Date remains an independent bridge oracle.
for (const year of [-20000, 20000, 100000]) {
  const jd = library.core.gregorianToJD(year, 3, 1);
  const outputs = Object.fromEntries(
    methods
      .filter((method) => !/chinese|greek|babylonian/.test(method))
      .map((method) => [method, invoke(method, jd)]),
  );
  valid.push({ jd, date: [year, 3, 1, 0], outputs });
}
const runtime = {};
for (const name of [
  'core/jd.js',
  'core/validation.js',
  'coptic.js',
  'islamic.js',
  'hebrew.js',
  'egyptian.js',
  'zoroastrian.js',
  'maya.js',
]) {
  try {
    runtime[name] = sha256(await readFile(new URL(name, libraryURL)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const result = {
  label: option('--label'),
  node: process.version,
  runtime,
  invalidCases: invalid.length,
  disagreements: invalid.filter((row) => !row.agrees).length,
  calculationTimeouts: invalid.filter((row) => row.outcome.status === 'timeout').length,
  validDates: valid.length,
  validOutputs: valid.reduce((n, row) => n + Object.keys(row.outputs).length, 0),
  validRowsSha256: sha256(JSON.stringify(valid)),
  invalid,
  valid,
};
await writeFile(option('--out'), `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    label: result.label,
    invalidCases: result.invalidCases,
    disagreements: result.disagreements,
    timeouts: result.calculationTimeouts,
    validDates: result.validDates,
    validOutputs: result.validOutputs,
    validRowsSha256: result.validRowsSha256,
  }),
);
if (!args.includes('--observe-only')) assert.equal(result.disagreements, 0);
