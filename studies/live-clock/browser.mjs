// node browser.mjs BASE OUTPUT before|after LIBRARY_INDEX
// Observes actual hosted/local UI after disconnecting. Independent calendar
// anchors are cited in README.md; the library is used for full parity separately.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox } from '@playwright/test';

const [base, output, phase, library] = process.argv.slice(2);
assert(base && output && ['before', 'after'].includes(phase) && library);
const api = await import(pathToFileURL(resolve(library)).href);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cases = [
  {
    id: 'athyr',
    jd: 2460489.5,
    calendar: 'egyptian',
    before: 'Akhet I, day 13',
    after: 'III Akhet, day 73',
  },
  {
    id: 'maya',
    jd: 2456282.5,
    calendar: 'maya-long-count',
    before: null,
    after: 'Lord of the Night G9',
  },
  {
    id: 'piedras-negras',
    jd: 1967418.5,
    calendar: 'maya-long-count',
    before: null,
    after: 'Lord of the Night G7',
  },
  {
    id: 'ethiopian',
    jd: 2461325.5,
    calendar: 'ethiopian',
    before: 'Ethiopian Anno Mundi',
    after: 'Amete Mihret',
  },
  {
    id: 'babylonian-2020',
    jd: 2458873.876590278,
    calendar: 'babylonian',
    before: '2 Shabatu',
    after: '1 Shabatu',
  },
  {
    id: 'greek-2022',
    jd: 2459848.9340902776,
    calendar: 'greek',
    before: '1 Pyanepsion',
    after: '2 Pyanepsion',
  },
];
await mkdir(output, { recursive: true });
const receipts = [];
for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
  const browser = await launcher.launch();
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage(),
      errors = [],
      late = [],
      external = [],
      flows = [];
    let offline = false;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (!/^https?:/.test(request.url())) return;
      if (offline) late.push(request.url());
      if (new URL(request.url()).origin !== new URL(base).origin) external.push(request.url());
    });
    await page.goto(`${base}#jd=${cases[0].jd}&loc=Rome`);
    await page.locator('.tablet').last().waitFor();
    await page.evaluate(() => Promise.allSettled([...document.fonts].map((face) => face.load())));
    await context.setOffline(true);
    offline = true;
    const assets = await page.evaluate(() =>
      [...document.querySelectorAll('script[src],link[rel="stylesheet"]')].map(
        (el) => el.src || el.href,
      ),
    );
    for (const item of cases) {
      await page.evaluate((jd) => {
        location.hash = `jd=${jd}&loc=Rome`;
      }, item.jd);
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      const tablet = page.locator(`[data-calendar="${item.calendar}"]`);
      const summary = await tablet.locator('.tablet-summary').innerText();
      if (item[phase] !== null) assert(summary.includes(item[phase]), `${item.id}: ${summary}`);
      else
        assert(
          !summary.includes('Lord of the Night'),
          `${item.id}: baseline unexpectedly shows a corrected G label`,
        );
      await tablet.locator('summary').click();
      const text = await tablet.innerText();
      const screenshot = `${engine}-${width}-${item.id}.png`;
      await tablet.screenshot({ path: resolve(output, screenshot), animations: 'disabled' });
      flows.push({
        ...item,
        summary,
        native: await tablet.locator('.tablet-native').innerText(),
        method: await tablet.locator('.method').innerText(),
        screenshot,
        text,
      });
      await tablet.locator('summary').click();
    }
    let lunarYear;
    const jd = api.core.gregorianToJD(2033, 12, 22) + 4 / 24;
    await page.evaluate((jd) => {
      location.hash = `jd=${jd}&loc=Babylon`;
    }, jd);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const opener = page.getByRole('button', { name: 'Inspect months and leap rule' });
    if (phase === 'before') {
      assert.equal(await opener.count(), 0);
      lunarYear = {
        available: false,
        chinese: await page.locator('[data-calendar="chinese"]').innerText(),
      };
    } else {
      await opener.focus();
      await page.keyboard.press('Enter');
      const ledger = page.locator('#chinese-year');
      await ledger.locator(':scope > summary').waitFor();
      assert.equal(await ledger.getAttribute('open'), '');
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download lunar year (JSON)' }).click();
      const bytes = await readFile(await (await pending).path());
      const actual = JSON.parse(bytes);
      assert.deepEqual(actual, api.chinese.inspectChineseYear(2033));
      const download = `${engine}-${width}-chinese-2033.json`;
      await writeFile(resolve(output, download), bytes);
      const leap = ledger
        .getByRole('row')
        .filter({ has: page.getByRole('button', { name: 'Go to leap month 11, 2033 CE' }) });
      assert.match(await leap.innerText(), /22 Dec 2033 CE/);
      const jump = leap.getByRole('button');
      await jump.focus();
      await page.keyboard.press('Enter');
      assert.match(
        await page.locator('[data-calendar="chinese"] .tablet-translit').innerText(),
        /leap month 11 day 1/,
      );
      await page.getByRole('button', { name: 'Forward one day', exact: true }).click();
      assert.match(
        await page.locator('[data-calendar="chinese"] .tablet-translit').innerText(),
        /leap month 11 day 2/,
      );
      await ledger.screenshot({
        path: resolve(output, `${engine}-${width}-chinese.png`),
        animations: 'disabled',
      });
      lunarYear = {
        available: true,
        download,
        sha256: hash(bytes),
        completeLibraryParity: true,
        keyboardMonthJump: true,
        nextDay: true,
      };
    }
    const violations = (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => v.id);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(late, []);
    assert.deepEqual(external, []);
    assert.deepEqual(violations, []);
    assert(fits);
    receipts.push({
      base,
      phase,
      engine,
      browserVersion: browser.version(),
      width,
      assets,
      flows,
      lunarYear,
      errors,
      requestsAfterDisconnect: late,
      externalRequests: external,
      axeViolations: violations,
      noPageOverflow: fits,
    });
    await context.close();
  }
  await browser.close();
}
await writeFile(resolve(output, 'receipt.json'), `${JSON.stringify(receipts, null, 2)}\n`);
console.log(
  `${phase}: ${receipts.length} offline sessions; ${receipts.flatMap((r) => r.flows).length} calendar views`,
);
