import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) requests.push(request.url());
    });
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) =>
        window.__cspViolations.push(event.violatedDirective),
      );
    });
    await use(page);
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  },
});
const readout = (page) => page.locator('#readout-primary');
const time = (page) => page.locator('#readout-secondary');
const year = (page) => page.getByLabel('Year (use era selector for BCE)');
const day = (page) => page.getByLabel('Day', { exact: true });
async function load(page, hash = '#jd=2460341&loc=Rome') {
  await page.goto(`./${hash}`);
  await expect(page.locator('.tablet')).toHaveCount(12);
}
async function enter(page, y, month, d, era = 'CE') {
  await year(page).fill(y);
  await page.getByLabel('Era', { exact: true }).selectOption(era);
  await page.getByLabel('Month', { exact: true }).selectOption(month);
  await day(page).fill(d);
  await page.getByRole('button', { name: 'Go', exact: true }).click();
}
async function mockLocation(page, mode = 'pending') {
  await page.addInitScript((mode) => {
    window.__geoRequests = [];
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, error) {
          if (mode === 'throw') throw new Error('location service disabled');
          window.__geoRequests.push({ success, error });
        },
      },
    });
  }, mode);
}
async function position(page, index, lat, lon) {
  await page.evaluate(
    ({ index, lat, lon }) =>
      window.__geoRequests[index].success({ coords: { latitude: lat, longitude: lon } }),
    { index, lat, lon },
  );
}

test('malformed links remain usable and a valid hash navigation recovers', async ({ page }) => {
  await load(page, '#jd=%E0%A4%A');
  await expect(page.locator('.control-status')).toContainText('invalid');
  await page.evaluate(() => {
    location.hash = 'jd=2451545&loc=Babylon';
  });
  await expect(readout(page)).toHaveText('1 January 2000 CE');
  await expect(page.getByLabel('Ancient city')).toHaveValue('Babylon');
  await expect(page.locator('.control-status')).toBeHidden();
  await page.evaluate(() => {
    location.hash = 'jd=1e308';
  });
  await expect(page.locator('.control-status')).toContainText('invalid');
  await expect(readout(page)).toHaveText('1 January 2000 CE');
  await page.getByRole('button', { name: 'Return to now' }).click();
  await expect(page).toHaveURL(/#live=1&loc=Babylon$/);
});

test('invalid date drafts preserve the result and recover with Enter', async ({ page }) => {
  await load(page);
  for (const [y, m, d] of [
    ['2025', '2', '31'],
    ['0', '1', '1'],
    ['2025.5', '1', '1'],
    ['5001', '1', '1'],
    ['2025', '1', ''],
  ]) {
    await enter(page, y, m, d);
    await expect(page.locator('#date-error')).toBeVisible();
    await expect(readout(page)).toHaveText('31 January 2024 CE');
    await expect(page).toHaveURL(/#jd=2460341&loc=Rome$/);
  }
  await year(page).fill('2024');
  await page.getByLabel('Month', { exact: true }).selectOption('2');
  await day(page).fill('29');
  await day(page).press('Enter');
  await expect(readout(page)).toHaveText('29 February 2024 CE');
  await expect(time(page)).toContainText('12:00 UTC');
  await expect(page.locator('#date-error')).toBeHidden();
});

test('month/year steps clamp leap days and retain UTC time', async ({ page }) => {
  await load(page);
  await page.getByRole('button', { name: 'Forward one month' }).click();
  await expect(readout(page)).toHaveText('29 February 2024 CE');
  await expect(time(page)).toContainText('12:00 UTC');
  await page.getByRole('button', { name: 'Forward one year' }).click();
  await expect(readout(page)).toHaveText('28 February 2025 CE');
  await expect(time(page)).toContainText('12:00 UTC');
  await enter(page, '1', '12', '31', 'BCE');
  await page.getByRole('button', { name: 'Forward one day' }).click();
  await expect(readout(page)).toHaveText('1 January 1 CE');
  await expect(page.getByLabel('Era', { exact: true })).toHaveValue('CE');
});

test('year scrub keeps one anchor through multiple inputs and returns to a leap day', async ({
  page,
}) => {
  await load(page);
  await enter(page, '2024', '2', '29');
  const slider = page.getByRole('slider');
  await slider.focus();
  for (const [offset, expected] of [
    [10, '28 February 2034 CE'],
    [20, '29 February 2044 CE'],
    [0, '29 February 2024 CE'],
  ]) {
    await slider.evaluate((node, offset) => {
      node.value = String(offset);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, offset);
    await expect(slider).toHaveValue(String(offset));
    await expect(readout(page)).toHaveText(expected);
  }
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(readout(page)).toHaveText('28 February 2026 CE');
  await expect(slider).toHaveValue('2');
  await slider.press('Tab');
  await expect(slider).toHaveValue('0');
});

test('pointer dragging keeps a stable year anchor until release', async ({ page }) => {
  await load(page);
  const slider = page.getByRole('slider');
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (!box) throw new Error('Missing scrubber bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (const fraction of [0.6, 0.7]) {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2, { steps: 5 });
    const offset = Number(await slider.inputValue());
    expect(offset).toBeGreaterThan(0);
    await expect(readout(page)).toHaveText(`31 January ${2024 + offset} CE`);
    await expect(time(page)).toContainText('12:00 UTC');
  }
  await page.mouse.up();
  await expect(slider).toHaveValue('0');
});

test('browser history restores each valid time hash', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    location.hash = 'jd=2451545&loc=Babylon';
  });
  await expect(readout(page)).toHaveText('1 January 2000 CE');
  await page.goBack();
  await expect(readout(page)).toHaveText('31 January 2024 CE');
  await expect(page.getByLabel('Ancient city')).toHaveValue('Rome');
  await page.goForward();
  await expect(readout(page)).toHaveText('1 January 2000 CE');
  await expect(page.getByLabel('Ancient city')).toHaveValue('Babylon');
});

test('date bounds disable outward moves and bound the scrubber', async ({ page }) => {
  await load(page);
  await enter(page, '5000', '12', '31');
  for (const unit of ['day', 'month', 'year'])
    await expect(page.getByRole('button', { name: `Forward one ${unit}` })).toBeDisabled();
  await expect(page.getByRole('slider')).toHaveAttribute('max', '0');
  await enter(page, '5001', '1', '1', 'BCE');
  for (const unit of ['day', 'month', 'year'])
    await expect(page.getByRole('button', { name: `Back one ${unit}` })).toBeDisabled();
  await expect(page.getByRole('slider')).toHaveAttribute('min', '0');
  await expect(page.locator('.tablet')).toHaveCount(12);
  await expect(page.locator('#tablets-mount')).not.toContainText(/NaN|undefined|Infinity/);
});

test('live ticks preserve date drafts, open explanations, focus and link mode across reload', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
  await load(page, '#live=1&loc=Babylon');
  await year(page).fill('1999');
  const summary = page.locator('.tablet summary').first();
  await summary.click();
  await summary.focus();
  await page.clock.runFor(30_001);
  await expect(year(page)).toHaveValue('1999');
  await expect(summary).toBeFocused();
  await expect(page.locator('.tablet details').first()).toHaveAttribute('open', '');
  await expect(page).toHaveURL(/#live=1&loc=Babylon$/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ticking now' })).toBeVisible();
  await expect(page.getByLabel('Ancient city')).toHaveValue('Babylon');
});

test('calendar nodes and explanations survive travel and location changes', async ({ page }) => {
  await load(page);
  const summary = page.locator('.tablet summary').first();
  await summary.click();
  await page.evaluate(() => {
    window.__firstTablet = document.querySelector('.tablet');
  });
  await page.getByRole('button', { name: 'Ides of March, 44 BCE' }).click();
  await page.getByLabel('Ancient city').selectOption('Tikal');
  await expect(page.locator('.tablet details').first()).toHaveAttribute('open', '');
  expect(
    await page.evaluate(() => window.__firstTablet === document.querySelector('.tablet')),
  ).toBe(true);
  await expect(page.locator('.tablet').first()).toContainText('Id. Mart.');
  await expect(page.locator('.tablet-name')).toHaveCount(12);
});

test('city selection changes the seasonal time and round-trips in the link', async ({ page }) => {
  await load(page);
  const sunrise = await page.locator('.seasonal-sunrise').textContent();
  await page.getByLabel('Ancient city').selectOption("Chang'an (Xi'an)");
  await expect(page.locator('#seasonal-heading')).toContainText("Chang'an");
  await expect(page.locator('.seasonal-sunrise')).not.toHaveText(sunrise);
  await page.reload();
  await expect(page.getByLabel('Ancient city')).toHaveValue("Chang'an (Xi'an)");
  await expect(readout(page)).toHaveText('31 January 2024 CE');
});

test('late geolocation cannot replace a chosen city or a cancelled request', async ({ page }) => {
  await mockLocation(page);
  await load(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page.getByLabel('Ancient city').selectOption('Athens');
  await position(page, 0, 80, 0);
  await expect(page.getByLabel('Ancient city')).toHaveValue('Athens');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page.getByRole('button', { name: 'Cancel location' }).click();
  await position(page, 1, 0, 0);
  await expect(page.getByLabel('Ancient city')).toHaveValue('Athens');
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
});

test('new geolocation request owns its response after an unanswered timeout', async ({ page }) => {
  await page.clock.install();
  await mockLocation(page);
  await load(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page.clock.runFor(20_001);
  await expect(page.locator('.location-field')).toContainText('No answer');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await position(page, 0, 0, 0);
  await expect(page.getByLabel('Ancient city')).toHaveValue('Rome');
  await position(page, 1, 80, 0);
  await expect(page.getByLabel('Ancient city')).toHaveValue('My location');
  await expect(page.locator('.seasonal-latin')).toHaveText('Seasonal hour unavailable');
  expect(page.url()).not.toContain('80');
  await expect(page).toHaveURL(/loc=private$/);
  await page.reload();
  await expect(page.getByLabel('Ancient city')).toHaveValue('Rome');
  await expect(page.locator('.control-status')).toContainText('original tab');
});

test('geolocation exceptions and invalid coordinates recover', async ({ page }) => {
  await mockLocation(page, 'throw');
  await load(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.locator('.location-field')).toContainText('could not find');
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
});

test('personal location denial and invalid coordinates retain the city', async ({ page }) => {
  await mockLocation(page);
  await load(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page.evaluate(() => window.__geoRequests[0].error({ code: 1 }));
  await expect(page.locator('.location-field')).toContainText('refused');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await position(page, 1, 91, 0);
  await expect(page.getByLabel('Ancient city')).toHaveValue('Rome');
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
});

test('keyboard skip link retains the time permalink', async ({ page }) => {
  await load(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveURL(/#jd=2460341&loc=Rome$/);
});

test('light/dark desktop and mobile views remain accessible without overflow', async ({ page }) => {
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) await load(page);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute('data-theme', theme),
        theme,
      );
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations().map((animation) => animation.finished.catch(() => {})),
        ),
      );
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
