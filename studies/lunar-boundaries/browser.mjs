// Real production assets; HTTP server stops before the first boundary change.
// node browser.mjs DIST_ROOT OUTPUT baseline|verify SCREENSHOT_DIR
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox } from '@playwright/test';

const [dist, output, mode, screenshots] = process.argv.slice(2);
assert.ok(['baseline', 'verify'].includes(mode));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assets = new Map();
async function load(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await load(join(directory, entry.name), `${prefix}${entry.name}/`);
    else
      assets.set(`/horologium/${prefix}${entry.name}`, await readFile(join(directory, entry.name)));
  }
}
await load(resolve(dist));
await mkdir(screenshots, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const cases = [
  {
    id: 'greek-gap',
    jd: 2461224.396031973,
    calendar: 'greek',
    before: '18 Skirophorion, Ol. 701.2 (year begins 2025 CE)',
    after: '18 Skirophorion, Ol. 701.1 (year begins 2025 CE)',
  },
  {
    id: 'babylonian-midnight',
    jd: 2461147.376601852,
    calendar: 'babylonian',
    before: '30 Addaru II, SE 2336',
    after: '1 Nisannu, SE 2337',
  },
  {
    id: 'ancient-year',
    jd: -105060.12340972222,
    calendar: 'babylonian',
    before: '1 Nisannu, SE -4688',
    after: '1 Nisannu, SE -4689',
  },
  {
    id: 'unchanged-after-new-moon',
    jd: 2461147.936773862,
    calendar: 'babylonian',
    before: '1 Nisannu, SE 2337',
    after: '1 Nisannu, SE 2337',
  },
];
const results = [];
for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
  const browser = await launcher.launch();
  try {
    for (const width of [1440, 375]) {
      const served = new Map();
      const server = createServer((request, response) => {
        let path = new URL(request.url, 'http://localhost').pathname;
        if (path === '/horologium/') path += 'index.html';
        const body = assets.get(path);
        response.writeHead(body ? 200 : 404, {
          'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        if (body) served.set(path, { bytes: body.length, sha256: sha(body) });
        response.end(body ?? 'Not found');
      });
      await new Promise((done) => server.listen(0, '127.0.0.1', done));
      const origin = `http://127.0.0.1:${server.address().port}`;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      let stopped = false;
      const stop = async () => {
        if (stopped) return;
        await new Promise((done) => {
          server.close(done);
          server.closeAllConnections();
        });
        stopped = true;
      };
      try {
        const page = await context.newPage();
        const errors = [],
          lateRequests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (stopped && /^https?:/.test(request.url())) lateRequests.push(request.url());
        });
        await page.addInitScript(() => {
          window.policyViolations = [];
          document.addEventListener('securitypolicyviolation', (event) =>
            window.policyViolations.push(event.violatedDirective),
          );
        });
        await page.goto(`${origin}/horologium/#jd=2460341&loc=Babylon`);
        await page.locator('[data-calendar=babylonian]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await context.setOffline(true);
        await stop();
        const records = [];
        for (const item of cases) {
          await page.evaluate((jd) => {
            location.hash = `jd=${jd}&loc=Babylon`;
          }, item.jd);
          const card = page.locator(`[data-calendar=${item.calendar}]`);
          const expected = mode === 'baseline' ? item.before : item.after;
          await page.waitForFunction(
            ({ calendar, expected }) =>
              document.querySelector(`[data-calendar=${calendar}] .tablet-summary`).textContent ===
              expected,
            { calendar: item.calendar, expected },
          );
          const disclosure = card.locator('summary');
          await disclosure.focus();
          if (!(await card.locator('details').evaluate((node) => node.open)))
            await page.keyboard.press('Enter');
          assert.equal(await card.locator('details').evaluate((node) => node.open), true);
          assert.equal(await disclosure.evaluate((node) => document.activeElement === node), true);
          assert.equal(await card.locator('.tablet-badge').first().textContent(), 'reconstruction');
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
          );
          const record = {
            ...item,
            actual: expected,
            reconstructionVisible: true,
            disclosureKeyboardOpened: true,
            focusRetained: true,
          };
          if (item.id !== 'unchanged-after-new-moon') {
            const file = `${engine}-${width}-${item.id}.png`;
            await card.screenshot({ path: resolve(screenshots, file) });
            record.screenshot = file;
            record.screenshotSha256 = sha(await readFile(resolve(screenshots, file)));
          }
          records.push(record);
        }
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
        );
        const policyViolations = await page.evaluate(() => window.policyViolations);
        assert.deepEqual(errors, []);
        assert.deepEqual(policyViolations, []);
        if (mode === 'verify') assert.deepEqual(lateRequests, []);
        results.push({
          engine,
          browserVersion: browser.version(),
          width,
          serverStoppedBeforeNavigation: true,
          cacheControl: 'no-store',
          offline: true,
          cases: records,
          served: Object.fromEntries(served),
          errors,
          lateRequests,
          policyViolations,
          axeViolations: 0,
          horizontalOverflow: false,
        });
      } finally {
        await stop();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  output,
  `${JSON.stringify({ mode, results, scope: 'Production clock navigating to retained numerical counterexamples after the HTTP server was stopped. These remain declared reconstructions.' }, null, 2)}\n`,
);
console.log(
  `${results.length} offline contexts / ${results.length * cases.length} calendar navigations passed (${mode}).`,
);
