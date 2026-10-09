import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import { chinese, core } from '../../dist/lib/index.js';

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [];
    const external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url());
    });
    await use(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  },
});
const ledger = (page) => page.locator('#chinese-year');
const tablet = (page) => page.locator('[data-calendar="chinese"]');
async function visit(page, year, month, day, hour = 4) {
  const jd = core.gregorianToJD(year, month, day) + hour / 24;
  await page.goto(`./#jd=${jd}&loc=Babylon`);
  await expect(tablet(page)).toBeVisible();
}
async function inspect(page) {
  const opener = page.getByRole('button', { name: 'Inspect months and leap rule' });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(ledger(page)).toHaveAttribute('open', '');
  await expect(ledger(page).locator(':scope > summary')).toBeFocused();
}

test('2033 leap-month evidence, keyboard navigation and month jumps preserve the time link', async ({
  page,
}) => {
  await visit(page, 2033, 8, 25);
  await expect(tablet(page).locator('.tablet-translit')).toContainText('month 8 day 1');
  const originalURL = page.url();
  await inspect(page);
  expect(page.url()).toBe(originalURL);
  const month8 = ledger(page)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Go to month 8, 2033 CE', exact: true }) });
  await expect(month8).toContainText('No principal term');
  await expect(month8).toContainText('only 12 months');
  const leap = ledger(page)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Go to leap month 11, 2033 CE' }) });
  await expect(leap).toContainText('22 Dec 2033 CE');
  await expect(leap).toContainText('13-month cycle');
  const jump = leap.getByRole('button');
  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(jump).toBeFocused();
  await expect(leap).toHaveAttribute('aria-current', 'date');
  await expect(tablet(page).locator('.tablet-translit')).toContainText('leap month 11 day 1');
  await leap.locator('summary').click();
  await expect(leap.locator('details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Forward one day', exact: true }).click();
  await expect(tablet(page).locator('.tablet-translit')).toContainText('leap month 11 day 2');
  await expect(leap.locator('details')).toHaveAttribute('open', '');
  const shareURL = page.url();
  await page.reload();
  expect(page.url()).toBe(shareURL);
  await expect(tablet(page).locator('.tablet-translit')).toContainText('leap month 11 day 2');
});

test('offline downloads agree with the public library and remain snapshots after navigation', async ({
  page,
  context,
}) => {
  await visit(page, 2033, 12, 22);
  await inspect(page);
  await context.setOffline(true);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download lunar year (JSON)' }).click();
  await page.getByRole('button', { name: 'Next lunar year', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('horologium-chinese-year-2033.json');
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(saved).toEqual(chinese.inspectChineseYear(2033));
  await expect(ledger(page).getByRole('heading')).toContainText('2034 CE');
  await expect(ledger(page).getByRole('row').nth(1)).toContainText('assigned earlier');
  await page.getByRole('button', { name: 'Previous lunar year', exact: true }).click();
  await expect(ledger(page).getByRole('heading')).toContainText('2033 CE');
});

test('failed download leaves the evidence readable and can be retried', async ({ page }) => {
  await visit(page, 2033, 12, 22);
  await inspect(page);
  await page.evaluate(() => {
    window.__createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error('simulated unavailable object URLs');
    };
  });
  await page.getByRole('button', { name: 'Download lunar year (JSON)' }).click();
  await expect(ledger(page).getByRole('status')).toContainText('could not be created');
  await expect(ledger(page).getByRole('row')).toHaveCount(14);
  await page.evaluate(() => {
    URL.createObjectURL = window.__createObjectURL;
  });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download lunar year (JSON)' }).click();
  expect((await pending).suggestedFilename()).toContain('2033');
  await expect(ledger(page).getByRole('status')).toContainText('Downloaded');
});

test('live midnight changes the complete Chinese date together and preserves an unfinished date edit', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2027-02-05T15:59:50Z') });
  await page.goto('./#live=1&loc=Babylon');
  await inspect(page);
  await expect(ledger(page).getByRole('heading')).toContainText('2026 CE');
  await expect(tablet(page).locator('.tablet-translit')).toContainText('month 12 day 29');
  const year = page.getByLabel('Year (use era selector for BCE)');
  await year.fill('20');
  await page.clock.fastForward(20_000);
  await expect(year).toHaveValue('20');
  await expect(ledger(page)).toHaveAttribute('open', '');
  await expect(ledger(page).getByRole('heading')).toContainText('2027 CE');
  await expect(tablet(page).locator('.tablet-translit')).toContainText('month 1 day 1');
  await expect(ledger(page).locator('.chinese-year-selected')).toContainText('6 Feb 2027 CE');
});

test('historical projections and near-midnight events carry their limits beside the result', async ({
  page,
}) => {
  await visit(page, 1916, 2, 3);
  await expect(tablet(page).locator('.tablet-proleptic')).toContainText('Historical Beijing time');
  await inspect(page);
  await expect(ledger(page).locator('.chinese-year-note').first()).toContainText(
    'Historical Beijing time',
  );
  await visit(page, 2057, 9, 28);
  await inspect(page);
  const selected = ledger(page).locator('tr[aria-current="date"]');
  await expect(selected).toContainText('Near midnight');
  await selected.locator('summary').click();
  await expect(selected.locator('details')).toContainText('Small timing changes');
  await expect(ledger(page).locator('.chinese-year-sources a').first()).toHaveAttribute(
    'href',
    /2057e\.pdf$/,
  );
});

test('both ends of the date editor remain inspectable with bounded year navigation', async ({
  page,
}) => {
  await visit(page, -5000, 1, 1);
  await inspect(page);
  await expect(ledger(page).getByRole('heading')).toContainText('5002 BCE');
  await expect(
    page.getByRole('button', { name: 'Previous lunar year', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Next lunar year', exact: true }).click();
  await expect(ledger(page).getByRole('heading')).toContainText('5001 BCE');
  await visit(page, 5000, 12, 31, 23);
  await inspect(page);
  await expect(page.getByRole('button', { name: 'Next lunar year', exact: true })).toBeDisabled();
  await expect(ledger(page).locator('.chinese-year-note').first()).toContainText('beyond');
});

for (const [width, theme] of [
  [320, 'light'],
  [320, 'dark'],
  [375, 'light'],
  [375, 'dark'],
  [1280, 'light'],
  [1280, 'dark'],
]) {
  test(`lunar-year inspection fits ${width}px in ${theme} and passes the accessibility scan`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await visit(page, 2033, 12, 22);
    await inspect(page);
    await expect(ledger(page).getByRole('row')).toHaveCount(14);
    const size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.width);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
