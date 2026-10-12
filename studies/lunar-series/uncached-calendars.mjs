// Execute the original calendar algorithms with the corrected lunar model.
// Imports are rebound in memory; neither checkout nor installed package is edited.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function uncachedCalendars(baseline, candidate) {
  const result = { referenceModules: [] };
  for (const name of ['babylonian', 'greek']) {
    const source = await readFile(resolve(baseline, `dist/lib/${name}.js`), 'utf8');
    assert.ok(!source.includes('yearCache') && !source.includes('recentStructures'));
    const rebound = source.replace(
      /from (['"])(\.[^'"]+)\1/g,
      (_, _quote, relative) =>
        `from ${JSON.stringify(pathToFileURL(resolve(candidate, 'dist/lib', relative)).href)}`,
    );
    result[name] = await import(
      `data:text/javascript;base64,${Buffer.from(rebound).toString('base64')}`
    );
    result.referenceModules.push({
      name,
      sha256: createHash('sha256').update(source).digest('hex'),
    });
  }
  return result;
}
