// node browser.mjs BUILT_ROOT RECEIPT SCREENSHOT_DIR
// Real production assets. Stop serving before changing dates in an offline tab.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox } from '@playwright/test';

const [root, output, screenshots] = process.argv.slice(2).map((path) => resolve(path));
const astronomy = await import(pathToFileURL(join(root, 'dist/lib/astronomy/planets.js')));
const { gregorianToJD } = await import(pathToFileURL(join(root, 'dist/lib/core/jd.js')));
const cases = [
  ['Saturn ancient example', 698654.5],
  ['44 BCE date', gregorianToJD(-43, 3, 15)],
  ['J2000 unchanged control', 2451545],
  ['modern 2026', gregorianToJD(2026, 1, 1)],
  ['long fit first epoch', gregorianToJD(-2999, 1, 1)],
  ['long fit last epoch', gregorianToJD(3000, 1, 1)],
  ['first supported year', gregorianToJD(-5000, 1, 1) + 0.5],
  ['last supported year', gregorianToJD(5000, 12, 31) + 0.5],
  ...[1800, 2050].flatMap((year) =>
    [-0.001, 0, 0.001].map((delta) => [
      `fit switch ${year} ${delta}`,
      gregorianToJD(year, 1, 1) + delta,
    ]),
  ),
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assets = new Map();
async function load(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await load(join(directory, entry.name), `${prefix}${entry.name}/`);
    else
      assets.set(`/horologium/${prefix}${entry.name}`, await readFile(join(directory, entry.name)));
  }
}
await load(join(root, 'dist/app'));
await mkdir(screenshots, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
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
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
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
        const origin = new URL(
          process.env.HOROLOGIUM_STUDY_URL ?? `http://127.0.0.1:${server.address().port}`,
        ).origin;
        const externalRequests = [];
        const errors = [],
          consoleErrors = [],
          lateRequests = [],
          responseChecks = [];
        page.on('response', (response) => {
          if (!/^https?:/.test(response.url())) return;
          responseChecks.push(
            (async () => {
              const name = new URL(response.url()).pathname;
              const key = name.endsWith('/') ? `${name}index.html` : name;
              const body = await response.body();
              assert.deepEqual(body, assets.get(key), key);
              served.set(key, { bytes: body.length, sha256: sha(body) });
            })(),
          );
        });
        await page.addInitScript(() => {
          window.__planetPolicy = [];
          document.addEventListener('securitypolicyviolation', (e) =>
            window.__planetPolicy.push(e.violatedDirective),
          );
        });
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('request', (request) => {
          if (stopped && /^https?:/.test(request.url())) lateRequests.push(request.url());
          if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin)
            externalRequests.push(request.url());
        });
        await page.goto(
          `${process.env.HOROLOGIUM_STUDY_URL ?? `http://127.0.0.1:${server.address().port}/horologium/`}#jd=2460341&loc=Rome`,
        );
        await page.locator('[data-calendar=babylonian]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.evaluate(
            () => [...document.fonts].filter((face) => face.status !== 'loaded').length,
          ),
          0,
        );
        await Promise.all(responseChecks);
        await context.setOffline(true);
        await stop();
        const records = [];
        for (const [name, jd] of cases) {
          const selected = astronomy.planetPositions?.(jd);
          const expected = Object.fromEntries(
            selected
              ? selected.positions.map((p) => [p.name.toLowerCase(), p.longitudeDeg])
              : astronomy.PLANETS.map((p) => [
                  p.name.toLowerCase(),
                  astronomy.planetLongitude(p, jd),
                ]),
          );
          await page.evaluate((jd) => {
            location.hash = `jd=${jd}&loc=Rome`;
          }, jd);
          await page.waitForFunction(
            (expected) =>
              Object.entries(expected).every(([planet, angle]) => {
                const value = Number.parseFloat(
                  document.querySelector(`.planet-${planet}`).style.transform.slice(7),
                );
                // CSSOM serializes angles to fewer digits than JavaScript.
                return Math.abs(value - angle) < 0.0006;
              }),
            expected,
          );
          await page.evaluate(async () => {
            await Promise.all(document.getAnimations().map((animation) => animation.finished));
          });
          const state = await page.evaluate(() => ({
            planets: Object.fromEntries(
              [...document.querySelectorAll('.planet-pointer')].map((p) => [
                p.querySelector('title').textContent.toLowerCase(),
                Number.parseFloat(p.style.transform.slice(7)),
              ]),
            ),
            renderedPlanets: Object.fromEntries(
              [...document.querySelectorAll('.planet-pointer')].map((p) => {
                const line = p.querySelector('line');
                const matrix = line.getScreenCTM();
                const start = new DOMPoint(
                  line.x1.baseVal.value,
                  line.y1.baseVal.value,
                ).matrixTransform(matrix);
                const end = new DOMPoint(
                  line.x2.baseVal.value,
                  line.y2.baseVal.value,
                ).matrixTransform(matrix);
                const angle =
                  ((Math.atan2(end.x - start.x, start.y - end.y) * 180) / Math.PI + 360) % 360;
                return [p.querySelector('title').textContent.toLowerCase(), angle];
              }),
            ),
            nonPlanetPointers: [...document.querySelectorAll('.sun-pointer,.moon-pointer')].map(
              (p) => p.style.transform,
            ),
            readout: document.querySelector('.readout').textContent,
            calendars: [...document.querySelectorAll('.tablet-summary')].map((p) => p.textContent),
            noOverflow: document.documentElement.scrollWidth <= innerWidth,
            limitations: document.querySelector('.dial-caption-note').textContent.trim(),
          }));
          assert.ok(state.noOverflow);
          for (const [planet, angle] of Object.entries(expected)) {
            const error = Math.abs(((state.renderedPlanets[planet] - angle + 540) % 360) - 180);
            assert.ok(
              error < 0.0006,
              `${engine}/${width}/${name}/${planet}: rendered error ${error}`,
            );
          }
          if (selected) {
            assert.ok(
              state.limitations.includes(
                !selected.model.inRange
                  ? 'outside the 3000 BCE'
                  : selected.model.id === 'jpl-1800-2050'
                    ? '1800–2050 CE fit'
                    : '3000 BCE–3000 CE fit',
              ),
            );
          }
          const row = { name, jd, ...state, model: selected?.model ?? 'baseline Table 1' };
          if (
            name === 'Saturn ancient example' &&
            ((engine === 'chromium' && width === 1440) || (engine === 'firefox' && width === 375))
          ) {
            const file = `${engine}-${width}.png`;
            await page.screenshot({ path: join(screenshots, file) });
            row.screenshot = { file, sha256: sha(await readFile(join(screenshots, file))) };
          }
          records.push(row);
        }
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
        );
        assert.deepEqual(externalRequests, []);
        assert.deepEqual(errors, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(lateRequests, []);
        assert.deepEqual(await page.evaluate(() => window.__planetPolicy), []);
        results.push({
          engine,
          version: browser.version(),
          width,
          offline: true,
          serverStoppedBeforeNavigation: true,
          surface: process.env.HOROLOGIUM_STUDY_URL ?? 'local production build',
          cases: records,
          served: Object.fromEntries(served),
          externalRequests,
          accessibilityViolations: axe.violations.length,
          errors,
          consoleErrors,
          lateRequests,
        });
      } finally {
        await context.close();
        await stop();
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(
  JSON.stringify({
    browserSessions: results.length,
    dateChanges: results.reduce((sum, row) => sum + row.cases.length, 0),
    screenshots: 2,
  }),
);
