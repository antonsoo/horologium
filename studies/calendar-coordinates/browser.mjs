import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
for (const name of ['--source', '--phase', '--out', '--shots']) assert.ok(args.includes(name));
const source = resolve(option('--source'));
const phase = option('--phase');
assert.ok(['before', 'after'].includes(phase));
const output = resolve(option('--out'));
const shots = resolve(option('--shots'));
const base = 'http://127.0.0.1:4399/horologium/';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assets = {};
async function scan(folder, prefix = '') {
  for (const file of await readdir(folder, { withFileTypes: true })) {
    const relative = `${prefix}${file.name}`;
    if (file.isDirectory()) await scan(join(folder, file.name), `${relative}/`);
    else assets[relative] = sha256(await readFile(join(folder, file.name)));
  }
}
await scan(join(source, 'dist/app'));
await mkdir(output, { recursive: true });
await mkdir(shots, { recursive: true });
const cases = [
  {
    id: 'athyr',
    jd: 2460489.5,
    calendar: 'egyptian',
    before: 'Akhet I, day 13',
    after: 'III Akhet, day 73',
  },
  {
    id: 'pharmuthi',
    jd: 2460639.5,
    calendar: 'egyptian',
    before: 'Peret II, day 13',
    after: 'IV Peret, day 103',
  },
  {
    id: 'mesore',
    jd: 2460759.5,
    calendar: 'egyptian',
    before: 'Shemu III, day 13',
    after: 'IV Shemu, day 103',
  },
  {
    id: 'piedras-negras',
    jd: 1967418.5,
    calendar: 'maya-long-count',
    longCount: '9.12.2.0.16',
    lord: 'G7',
  },
  {
    id: 'maya-period',
    jd: 2456282.5,
    calendar: 'maya-long-count',
    longCount: '13.0.0.0.0',
    lord: 'G9',
  },
  {
    id: 'epagomenal',
    jd: 2460781.5,
    calendar: 'egyptian',
    before: 'the 5 epagomenal days',
    after: 'the 5 epagomenal days',
  },
];
const server = spawn(
  process.execPath,
  [
    join(source, 'node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4399',
    '--strictPort',
  ],
  { cwd: source, stdio: 'pipe' },
);
let serverText = '';
server.stdout.on('data', (chunk) => {
  serverText += chunk;
});
server.stderr.on('data', (chunk) => {
  serverText += chunk;
});
const captures = [];
const screenshots = [];
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverText);
    if (serverText.includes('Local:')) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  for (const [file, digest] of Object.entries(assets)) {
    const response = await fetch(new URL(file, base));
    assert.equal(response.status, 200);
    assert.equal(sha256(Buffer.from(await response.arrayBuffer())), digest, file);
  }
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch({ headless: true });
    try {
      for (const width of [1440, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        try {
          const page = await context.newPage();
          const errors = [];
          const requests = [];
          const responses = [];
          const loaded = {};
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
          });
          page.on('request', (request) => requests.push(request.url()));
          page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin !== new URL(base).origin) return;
            const relative = url.pathname.slice('/horologium/'.length) || 'index.html';
            if (!(relative in assets)) return;
            responses.push(
              (async () => {
                assert.equal(response.status(), 200, relative);
                const digest = sha256(await response.body());
                assert.equal(digest, assets[relative], relative);
                loaded[relative] = digest;
              })(),
            );
          });
          await page.addInitScript(() => {
            window.__coordinateCsp = [];
            document.addEventListener('securitypolicyviolation', (event) =>
              window.__coordinateCsp.push(event.violatedDirective),
            );
          });
          await page.goto(`${base}#jd=${cases[0].jd}&loc=Rome`);
          await page.locator('.tablet').last().waitFor();
          await page.waitForFunction(() =>
            [...document.fonts].every((font) => font.status === 'loaded'),
          );
          await page.evaluate(() => {
            window.__coordinateTablet = document.querySelector('[data-calendar="egyptian"]');
          });
          await Promise.all(responses);
          assert.equal(Object.keys(loaded).length, 29);
          const warmRequests = requests.length;
          await context.setOffline(true);
          for (const item of cases) {
            await page.evaluate((jd) => {
              location.hash = `jd=${jd}&loc=Rome`;
            }, item.jd);
            const tablet = page.locator(`[data-calendar="${item.calendar}"]`);
            if (item.longCount) {
              await page.waitForFunction(
                ({ calendar, longCount }) =>
                  document
                    .querySelector(`[data-calendar="${calendar}"] .tablet-native`)
                    .textContent.startsWith(longCount),
                item,
              );
            } else {
              await page.waitForFunction(
                ({ phase, item }) =>
                  document
                    .querySelector(`[data-calendar="${item.calendar}"] .tablet-summary`)
                    .textContent.startsWith(item[phase]),
                { phase, item },
              );
            }
            const native = await tablet.locator('.tablet-native').innerText();
            const summary = await tablet.locator('.tablet-summary').innerText();
            if (item.longCount) {
              assert.ok(native.startsWith(item.longCount));
              if (phase === 'after') assert.ok(summary.endsWith(`Lord of the Night ${item.lord}`));
              else assert.ok(!summary.includes('Lord of the Night'));
            } else assert.ok(summary.startsWith(item[phase]));
            await tablet.locator('summary').click();
            assert.equal(await tablet.locator('details').getAttribute('open'), '');
            const method = await tablet.locator('.method').innerText();
            await tablet.locator('summary').click();
            assert.ok(
              await page.evaluate(
                () =>
                  window.__coordinateTablet ===
                  document.querySelector('[data-calendar="egyptian"]'),
              ),
            );
            assert.ok(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            captures.push({
              engine,
              browser: browser.version(),
              width,
              id: item.id,
              jd: item.jd,
              native,
              summary,
              method,
            });
            if (
              ((engine === 'chromium' && width === 1440) ||
                (engine === 'firefox' && width === 375)) &&
              ['athyr', 'piedras-negras'].includes(item.id)
            ) {
              const name = `${engine}-${item.id}-${width}.png`;
              await tablet.screenshot({ path: join(shots, name) });
              screenshots.push(name);
            }
          }
          assert.equal(
            requests.length,
            warmRequests,
            'Offline dates and explanations issue no requests',
          );
          assert.ok(requests.every((url) => new URL(url).origin === new URL(base).origin));
          assert.deepEqual(errors, []);
          assert.deepEqual(await page.evaluate(() => window.__coordinateCsp), []);
          await Promise.all(responses);
          if (
            phase === 'after' &&
            ((engine === 'chromium' && width === 1440) || (engine === 'firefox' && width === 375))
          ) {
            const name = `${engine}-clock-${width}.png`;
            await page.screenshot({ path: join(shots, name), fullPage: true });
            screenshots.push(name);
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'browser.json'),
    `${JSON.stringify(
      {
        phase,
        node: process.version,
        assets,
        browserLoadedAssets: 29,
        captures,
        screenshots,
        offlineRequests: 0,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({
      phase,
      workflows: captures.length,
      servedFiles: Object.keys(assets).length,
      screenshots: screenshots.length,
      offlineRequests: 0,
    }),
  );
} finally {
  if (server.exitCode === null) {
    const exited = new Promise((done) => server.once('exit', done));
    server.kill('SIGTERM');
    await exited;
  }
}
