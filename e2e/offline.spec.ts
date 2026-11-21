import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base, type Page } from '@playwright/test';
import { build } from 'vite';
import { addFiles, decodeInPage, downloadBytes, expectColor, quadrants, waitPreview, waitReady } from './helpers.ts';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PREFIX = '/inkdoze/';
const DECODER = /\/(?:heic\.worker|libheif-bundle)-[\w-]+\.js$/;
const TAGLINE = 'Sleep screens for e-readers';
const TAGLINE_B = `${TAGLINE} (build B)`;
const READY = 'Ready to open offline.';
const RETRY = 'Try again';

function button(page: Page, name = 'Prepare for offline use') {
  return page.getByRole('button', { name, exact: true });
}

function offlineToggle(page: Page) {
  return page.getByText('Offline', { exact: true });
}

function status(page: Page) {
  return page.getByTestId('offline-status');
}

async function open(page: Page, url = './') {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
  });
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'InkDoze' })).toBeVisible();
}

async function prepare(page: Page, label?: string) {
  await button(page, label).click();
  await expect(status(page)).toHaveText(READY, { timeout: 15_000 });
  await expect(status(page)).toBeVisible();
}

async function downloadPng(page: Page, points: Array<[number, number]>) {
  await page.getByTestId('format').selectOption('png');
  await waitPreview(page, '480 × 800');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-one').click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const decoded = await decodeInPage(page, await downloadBytes(download), 'image/png', points);
  expect([decoded.width, decoded.height]).toEqual([480, 800]);
  return decoded;
}

async function exportPortrait(page: Page, decoder: 'wasm' | 'native') {
  const buffer = await readFile(new URL('../tests/fixtures/portrait-small.heic', import.meta.url));
  await addFiles(page, [{ name: 'portrait.heic', mimeType: 'image/heic', buffer }]);
  await waitReady(page, 1);
  const item = page.locator('.file-item');
  await expect(item).toContainText('600 × 800');
  await expect(item).toHaveAttribute('data-decoder', decoder);
  await page.getByTestId('auto-tone').uncheck();
  await page.getByRole('radio', { name: 'Colour', exact: true }).last().check({ force: true });
  const points: Array<[number, number]> = [[100, 160], [380, 160], [100, 640], [380, 640]];
  const png = await downloadPng(page, points);
  expectColor(png.at(...points[0]!), [230, 30, 30], 24);
  expectColor(png.at(...points[1]!), [30, 200, 60], 24);
  expectColor(png.at(...points[2]!), [30, 60, 220], 24);
  expectColor(png.at(...points[3]!), [240, 220, 40], 24);
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

async function buildFiles(dir: string) {
  const files = (await readdir(dir, { recursive: true })).filter((file) => extname(file) in MIME);
  return new Map(await Promise.all(files.map(async (file) => [file, await readFile(join(dir, file))] as const)));
}

type Fault = { status: number; body?: string | Buffer; mime?: string };

type Site = {
  url: string;
  publish: (dir: string) => Promise<void>;
  fail: (path: string, reply: () => Promise<Fault>) => void;
  restore: () => void;
};

// Serve real build files on a private origin. Failures here affect Service Worker
// requests too, which page-level Playwright routes cannot reliably intercept.
const test = base.extend<{ site: Site }>({
  site: async ({ baseURL }, runWithSite) => {
    if (!baseURL) throw new Error('Offline tests need a Playwright base URL.');
    const { pathname: prefix } = new URL(baseURL);
    let files = await buildFiles(DIST);
    let failure: { path: string; reply: () => Promise<Fault> } | undefined;
    const server = createServer(async (request, response) => {
      const path = request.url?.split('?')[0] ?? '';
      response.setHeader('Cache-Control', 'no-store');
      if (path === '/probe') {
        response.setHeader('Content-Type', 'text/plain');
        response.end('Outside InkDoze');
        return;
      }
      const file = path.slice(prefix.length) || 'index.html';
      const body = path.startsWith(prefix) ? files.get(file) : undefined;
      response.setHeader('Content-Type', MIME[extname(file)] ?? 'text/plain');
      if (failure?.path === file) {
        const result = await failure.reply();
        if (result.mime) response.setHeader('Content-Type', result.mime);
        response.writeHead(result.status).end(result.body);
      } else {
        response.writeHead(body ? 200 : 404).end(body);
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port.');
    try {
      await runWithSite({
        url: `http://127.0.0.1:${address.port}${prefix}`,
        publish: async (dir) => { files = await buildFiles(dir); },
        fail: (path, reply) => { failure = { path, reply }; },
        restore: () => { failure = undefined; },
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  },
});

test('exports online, then opens offline in a new tab and decodes the first HEIC', async ({ page, context, browserName }) => {
  const requested: string[] = [];
  context.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await open(page);
  await addFiles(page, [{ name: 'online.png', mimeType: 'image/png', buffer: quadrants() }]);
  await waitReady(page, 1);
  await downloadPng(page, []);

  const toggle = offlineToggle(page);
  await expect(button(page)).toBeHidden();
  await page.getByTestId('locale').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(button(page)).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(button(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button(page)).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  expect(requested.some((path) => DECODER.test(path) || path.endsWith('/sw.js'))).toBe(false);

  await prepare(page);
  await page.getByRole('heading', { name: 'InkDoze' }).click();
  await expect(status(page)).toBeHidden();
  await expect(page.locator('.file-item')).toHaveCount(1);
  const url = page.url();
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)).toBe(url);
  await page.close();
  await context.setOffline(true);

  const reopened = await context.newPage();
  const cachedResponses: string[] = [];
  context.on('response', (response) => {
    if (response.fromServiceWorker()) cachedResponses.push(new URL(response.url()).pathname);
  });
  await open(reopened, url);
  await offlineToggle(reopened).click();
  await expect(status(reopened)).toHaveText(READY);
  await expect(reopened.locator('.file-item')).toHaveCount(0);
  const decoder = browserName === 'webkit' && process.platform === 'darwin' ? 'native' : 'wasm';
  await exportPortrait(reopened, decoder);
  if (browserName === 'chromium') {
    expect(cachedResponses).toContain(PREFIX);
    expect(cachedResponses.some((path) => /\/libheif-bundle-[\w-]+\.js$/.test(path))).toBe(true);
  }
});

test('preparing in one tab updates the offline status of an already open tab', async ({ page, context }) => {
  await open(page);
  await offlineToggle(page).click();
  await expect(button(page)).toBeEnabled();

  const secondTab = await context.newPage();
  await open(secondTab, page.url());
  await offlineToggle(secondTab).click();
  await prepare(secondTab);

  await context.setOffline(true);
  await expect(status(page)).toHaveText(READY);
  await expect(button(page, 'Check for offline updates')).toBeVisible();
});

test('a missing required asset prevents readiness and preparation can be retried', async ({ page, site }) => {
  const decoder = (await readdir(join(DIST, 'assets'))).find((name) => name.startsWith('libheif-bundle-') && name.endsWith('.js'))!;
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  site.fail(`assets/${decoder}`, async () => {
    await held;
    return { status: 404 };
  });
  await open(page, site.url);
  await offlineToggle(page).click();
  try {
    await button(page).click();
    await expect(status(page)).toHaveText('Preparing files for offline use…');
  } finally {
    release();
  }
  await expect(status(page)).toContainText('Offline preparation failed.');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active ?? null)).toBeNull();
  const bytes = await readFile(join(DIST, 'assets', decoder));
  site.fail(`assets/${decoder}`, async () => ({ status: 200, body: bytes, mime: 'text/html' }));
  await button(page, RETRY).click();
  await expect(status(page)).toContainText('Offline preparation failed.');
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  site.restore();
  await prepare(page, RETRY);
});

test('exhausted storage prevents readiness and an evicted build can be prepared again', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'The test sets a temporary Chromium storage quota.');
  await open(page);
  await offlineToggle(page).click();
  const session = await context.newCDPSession(page);
  const origin = new URL(page.url()).origin;
  await session.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: 1024 });
  await button(page).click();
  await expect(status(page)).toContainText('available browser storage');
  await session.send('Storage.overrideQuotaForOrigin', { origin });
  await prepare(page, RETRY);

  const names = await page.evaluate(() => caches.keys());
  expect(names).toHaveLength(1);
  await page.evaluate((name) => caches.delete(name), names[0]!);
  await page.reload();
  await offlineToggle(page).click();
  await prepare(page);
  expect(await page.evaluate(() => caches.keys())).toEqual(names);
});

test('an incomplete update keeps A available until the full B build can activate', async ({ page, context, site, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'The update test traces Chromium Service Worker responses.');
  const bDir = info.outputPath('build-b');
  await build({
    logLevel: 'error',
    build: { outDir: bDir, emptyOutDir: true },
    plugins: [{
      name: 'test-build-b-tagline',
      transform: (code, id) => id.endsWith('/src/i18n/locales/en.ts') ? code.replace(TAGLINE, TAGLINE_B) : undefined,
    }],
    worker: { plugins: () => [{
      name: 'test-build-b-decoder',
      transform: (code, id) => id.endsWith('/src/worker/heic.worker.ts')
        ? code.replace('WebAssembly is not available', 'Build B requires WebAssembly') : undefined,
    }] },
  });
  await open(page, site.url);
  await offlineToggle(page).click();
  await page.evaluate(() => caches.open('inkdoze-offline-unrelated').then(() => undefined));
  await prepare(page);
  const a = page;
  await expect(a.locator('.tagline')).toHaveText(TAGLINE);
  expect(await a.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${site.url}sw.js`);
  const cacheA = (await a.evaluate(() => caches.keys())).find((name) => /^inkdoze-offline-[a-f0-9]{64}$/.test(name))!;
  expect(cacheA).toBeTruthy();

  await site.publish(bDir);
  const assetsB = await readdir(join(bDir, 'assets'));
  const entryB = assetsB.find((name) => /^index-.*\.js$/.test(name))!;
  const decoderB = assetsB.find((name) => /^heic\.worker-.*\.js$/.test(name))!;
  expect(await readdir(join(DIST, 'assets'))).not.toContain(decoderB);
  site.fail(`assets/${entryB}`, async () => ({ status: 404 }));
  await button(a, 'Check for offline updates').click();
  await expect(status(a)).toContainText('Offline preparation failed.');

  await context.setOffline(true);
  const secondA = await context.newPage();
  await open(secondA, site.url);
  await expect(secondA.locator('.tagline')).toHaveText(TAGLINE);
  await context.setOffline(false);

  site.fail(`assets/${entryB}`, async () => ({ status: 200, body: '// a different JavaScript file' }));
  await button(a, RETRY).click();
  await expect(status(a)).toContainText('Offline preparation failed.');
  site.restore();
  await button(a, RETRY).click();
  await expect(status(a)).toContainText('Update saved. Close all InkDoze tabs');
  const cachedA = context.waitForEvent('response', (response) =>
    /\/heic\.worker-[\w-]+\.js$/.test(response.url()) && response.fromServiceWorker());
  await exportPortrait(a, 'wasm');
  expect((await cachedA).url()).not.toContain(decoderB);
  await a.close();
  expect(await secondA.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
  await secondA.close();

  const probe = await context.newPage();
  const response = await probe.goto(new URL('/probe', site.url).href);
  expect(response?.fromServiceWorker()).toBe(false);
  await expect.poll(() => probe.evaluate(async (scope) => {
    const registration = await navigator.serviceWorker.getRegistration(scope);
    return registration?.active?.state === 'activated' ? await caches.keys() : [];
  }, site.url)).toEqual(['inkdoze-offline-unrelated', expect.stringMatching(/^inkdoze-offline-[a-f0-9]{64}$/)]);
  expect(await probe.evaluate((name) => caches.has(name), cacheA)).toBe(false);

  await context.setOffline(true);
  const b = await context.newPage();
  const cachedB = context.waitForEvent('response', (result) => result.url().endsWith(entryB) && result.fromServiceWorker());
  await open(b, site.url);
  await cachedB;
  await expect(b.locator('.tagline')).toHaveText(TAGLINE_B);
  await offlineToggle(b).click();
  await expect(status(b)).toHaveText(READY);
  const cachedDecoderB = context.waitForEvent('response', (result) => result.url().endsWith(decoderB) && result.fromServiceWorker());
  await exportPortrait(b, 'wasm');
  await cachedDecoderB;
});
