// Run against a built preview. Optional screenshot directory is argv[4].
// Usage: node studies/ethiopian-era/browser.mjs http://127.0.0.1:4201/horologium/ after
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';

const [baseURL, phase = 'after', screenshots] = process.argv.slice(2);
assert.ok(baseURL && ['before', 'after'].includes(phase));
const reference = JSON.parse(await readFile(new URL(`${phase}.json`, import.meta.url), 'utf8'));
if (screenshots) await mkdir(screenshots, { recursive: true });
const results = [];
for (const [engine, browserType] of Object.entries({ chromium, firefox })) {
  const browser = await browserType.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      const external = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url());
      });
      await page.goto(`${baseURL}#jd=2461326&loc=Rome`);
      await page.locator('[data-calendar="ethiopian"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await context.setOffline(true);
      for (const input of ['2026-10-12', '2023-09-11', '2023-09-12', '0008-08-26']) {
        const expected = reference.cases.find((c) => c.input === input);
        const [year, month, day] = input.split('-').map(Number);
        await page.getByLabel('Year (use era selector for BCE)').fill(String(year));
        await page.getByLabel('Era', { exact: true }).selectOption('CE');
        await page.getByLabel('Month', { exact: true }).selectOption(String(month));
        await page.getByLabel('Day', { exact: true }).fill(String(day));
        await page.getByRole('button', { name: 'Go', exact: true }).click();
        const card = page.locator('[data-calendar="ethiopian"]');
        const summary = await card.locator('.tablet-summary').innerText();
        assert.match(summary, new RegExp(`^${expected.actual.day} .+ ${expected.actual.year} \\(`));
        assert.ok(
          summary.includes(
            phase === 'after' ? 'Era of Incarnation, Amete Mihret' : 'Ethiopian Anno Mundi',
          ),
        );
        if (input === '2026-10-12') {
          await card.getByText('How this is computed', { exact: true }).click();
          const method = await card.locator('.method').innerText();
          assert.ok(
            method.includes(phase === 'after' ? '276 Julian years before' : '7-8 years after'),
          );
          if (screenshots)
            await card.screenshot({ path: resolve(screenshots, `${engine}-${width}.png`) });
        }
        assert.equal(await card.locator('.tablet-proleptic').isVisible(), expected.actual.year < 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        results.push({ engine, version: browser.version(), width, input, summary });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
console.log(
  JSON.stringify({ phase, offline: true, errors: [], externalRequests: [], results }, null, 2),
);
