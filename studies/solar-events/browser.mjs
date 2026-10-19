import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, firefox } from '@playwright/test';

const [baseURL, output, mode = 'after'] = process.argv.slice(2);
assert(
  baseURL && output,
  'Usage: node studies/solar-events/browser.mjs URL OUTPUT_DIR [before|after]',
);
const fixture = JSON.parse(
  await readFile(new URL('../../tests/fixtures/solar-events.json', import.meta.url)),
);
const cases = fixture.cases.filter((c) =>
  ['first-sunrise', 'first-sunset', 'phantom-daylight', 'north-short-day'].includes(c.name),
);
await mkdir(output, { recursive: true });
const workflows = [];
for (const [engine, browserType] of [
  ['chromium', chromium],
  ['firefox', firefox],
]) {
  const browser = await browserType.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [],
        external = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => {
        if (new URL(r.url()).origin !== new URL(baseURL).origin) external.push(r.url());
      });
      await page.addInitScript(() => {
        window.csp = [];
        document.addEventListener('securitypolicyviolation', (e) =>
          window.csp.push(e.violatedDirective),
        );
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (success) => {
              window.locationSuccess = success;
            },
          },
        });
      });
      await page.goto(`${baseURL}#jd=2461041.5&loc=Rome`);
      await page.waitForFunction(() => document.querySelectorAll('.tablet').length === 12);
      await page.evaluate(() => document.fonts.ready);
      await context.setOffline(true);
      const observations = [];
      for (const row of cases) {
        const instantJD = row.jd + 0.5 - row.longitudeDeg / 360;
        await page.evaluate((jd) => {
          location.hash = `jd=${jd}&loc=Rome`;
        }, instantJD);
        await expect(page.getByLabel('Ancient city')).toHaveValue('Rome');
        await page.getByRole('button', { name: 'Use my location' }).click();
        await page.evaluate(
          ({ lat, lon }) => window.locationSuccess({ coords: { latitude: lat, longitude: lon } }),
          { lat: row.latitudeDeg, lon: row.longitudeDeg },
        );
        await page.waitForFunction(() =>
          document.querySelector('.seasonal-hour h2').textContent.includes('My location'),
        );
        const state = await page.evaluate(() => ({
          sunrise: document.querySelector('.seasonal-sunrise').textContent,
          sunset: document.querySelector('.seasonal-sunset').textContent,
          label: document.querySelector('.seasonal-latin').textContent,
          phase: document.querySelector('.seasonal-phase').textContent,
          duration: document.querySelector('.seasonal-duration').textContent,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          hash: location.hash,
        }));
        if (row.name === 'first-sunrise') {
          assert.equal(state.sunrise, mode === 'after' ? '18:03 UTC (-1 day)' : 'No sunrise');
          assert.equal(state.sunset, 'No sunset');
        }
        if (row.name === 'first-sunset') {
          assert.equal(state.sunrise, 'No sunrise');
          assert.equal(state.sunset, mode === 'after' ? '10:24 UTC (+1 day)' : 'No sunset');
        }
        if (mode === 'after' && ['phantom-daylight', 'north-short-day'].includes(row.name)) {
          assert.equal(state.sunrise, 'Near horizon; uncertain');
          assert.equal(state.sunset, 'Near horizon; uncertain');
          assert.equal(state.label, 'Seasonal hour unavailable');
        }
        assert(!state.overflow);
        assert(state.hash.endsWith('loc=private'));
        observations.push({
          name: row.name,
          input: { instantJD, latitudeDeg: row.latitudeDeg, longitudeDeg: row.longitudeDeg },
          ...state,
        });
        if (
          engine === 'chromium' &&
          width === 1440 &&
          ['first-sunrise', 'phantom-daylight'].includes(row.name)
        ) {
          await page
            .locator('.seasonal-panel')
            .screenshot({ path: path.join(output, `${row.name}.png`) });
        }
        if (
          mode === 'after' &&
          engine === 'firefox' &&
          width === 375 &&
          row.name === 'phantom-daylight'
        ) {
          await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      assert.deepEqual(await page.evaluate(() => window.csp), []);
      workflows.push({
        engine,
        browser: browser.version(),
        width,
        offline: true,
        syntheticGeolocation: true,
        observations,
        pageErrors: errors,
        externalRequests: external,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  path.join(output, 'browser.json'),
  `${JSON.stringify({ mode, workflows }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    mode,
    workflows: workflows.length,
    controls: workflows.reduce((n, w) => n + w.observations.length, 0),
  }),
);
