import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { addFiles, decodeInPage, downloadBytes, encodeInPage, expectColor, makePng, quadrants, readZip, waitPreview, waitReady, type Rgba } from './helpers.ts';

// Fixtures written by scripts/make-heic-fixtures.swift with Apple's ImageIO. Display
// layout: red, green / blue, yellow quadrants and a black "F" in the middle.
const fixture = (name: string) => readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url));
const IPHONE = fixture('portrait-iphone-layout.heic'); // 3024×4032 displayed, 48 tiles, irot + EXIF 6
const SMALL = fixture('portrait-small.heic'); // 600×800 displayed, irot + EXIF 6

const RED: Rgba = [230, 30, 30, 255];
const GREEN: Rgba = [30, 200, 60, 255];
const BLUE: Rgba = [30, 60, 220, 255];
const YELLOW: Rgba = [240, 220, 40, 255];
const BLACK: Rgba = [0, 0, 0, 255];

const heic = (name: string, buffer: Buffer, mimeType = 'image/heic') => ({ name, mimeType, buffer });

/** Decoding path each engine should take: WebKit on macOS decodes HEIC itself. */
function expectedDecoder(info: TestInfo): 'native' | 'wasm' {
  return info.project.name === 'webkit' && process.platform === 'darwin' ? 'native' : 'wasm';
}

const DECODER_FILES = /heic\.worker-[\w-]+\.js|libheif-bundle-[\w-]+\.js/;

/**
 * Requests made by the page and its workers, and decoder workers started and stopped.
 * Firefox does not report the script request of a nested worker, so decoder starts
 * are counted from worker events; WebKit on Linux reports no nested worker events at
 * all, so `started` stays 0 there. The decoder chunk request is reported everywhere.
 */
function track(page: Page, context: BrowserContext) {
  const t = { requests: [] as string[], started: 0, stopped: 0, chunkLoads: 0 };
  context.on('request', (r) => {
    t.requests.push(r.url());
    if (/libheif-bundle-/.test(r.url())) t.chunkLoads++;
  });
  page.on('worker', (w) => {
    if (!/heic\.worker-/.test(w.url())) return;
    t.started++;
    w.on('close', () => t.stopped++);
  });
  return t;
}

function replaceBytes(buf: Buffer, from: number[], to: number[]): Buffer {
  const out = Buffer.from(buf);
  const at = out.indexOf(Buffer.from(from));
  expect(at, `pattern ${Buffer.from(from).toString('hex')}`).toBeGreaterThanOrEqual(0);
  out.set(to, at);
  return out;
}

const u32 = (v: number) => [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
const ispe = (w: number, h: number) => [...Buffer.from('ispe'), 0, 0, 0, 0, ...u32(w), ...u32(h)];

/** The iPhone-layout photo turned into a 48 MP grid: 8×6 tiles of 1024², output 8064×6048. */
function bigGrid(): Buffer {
  let b = replaceBytes(IPHONE, ispe(512, 512), ispe(1024, 1024));
  b = replaceBytes(b, ispe(4032, 3024), ispe(8064, 6048));
  return replaceBytes(b, [0, 0, 5, 7, 0x0f, 0xc0, 0x0b, 0xd0], [0, 0, 5, 7, 0x1f, 0x80, 0x17, 0xa0]);
}

/** Valid container, damaged HEVC data: the coded image at the end of mdat is overwritten. */
function damagedData(): Buffer {
  const b = Buffer.from(SMALL);
  b.fill(0x55, b.length - 600);
  return b;
}

async function open(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'InkDoze' })).toBeVisible();
}

/** Sample the preview canvas at positions relative to its size. */
async function previewAt(page: Page, points: Array<[number, number]>): Promise<Rgba[]> {
  return page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement, pts) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    return pts.map(([u, v]) => [...ctx.getImageData(Math.floor(u * c.width), Math.floor(v * c.height), 1, 1).data]);
  }, points) as Promise<Rgba[]>;
}

test.beforeEach(async ({ page }) => open(page));

test('iPhone-layout portrait HEIC: upright in the list, preview and sleep screen', async ({ page, context }, info) => {
  const t = track(page, context);
  await addFiles(page, [heic('IMG_0001.HEIC', IPHONE)]);
  await waitReady(page, 1);
  const item = page.locator('.file-item');
  await expect(item).toContainText('3024 × 4032');
  await expect(item).toHaveAttribute('data-decoder', expectedDecoder(info));

  // Thumbnail is portrait, as displayed.
  const thumb = await item.locator('.thumb img').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(thumb[0]).toBeLessThan(thumb[1]!);

  // Colour PNG for the default 480×800 screen. Fill scales 3024×4032 to 600×800 and keeps x 60..540.
  await page.getByTestId('auto-tone').uncheck();
  await page.getByRole('radio', { name: 'Colour', exact: true }).last().check({ force: true });
  await page.getByTestId('format').selectOption('png');
  await waitPreview(page, '480 × 800');

  // Display position (u, v) in the photo → output pixel.
  const at = (u: number, v: number): [number, number] => [Math.round(u * 600 - 60), Math.round(v * 800)];
  const probes: Array<[[number, number], Rgba]> = [
    [at(0.2, 0.2), RED],
    [at(0.8, 0.2), GREEN],
    [at(0.2, 0.8), BLUE],
    [at(0.8, 0.8), YELLOW],
    [at(0.42, 0.5), BLACK], // stem of the F
    [at(0.58, 0.44), GREEN], // open side of the F: black only if mirrored
  ];
  const preview = await previewAt(page, probes.map(([[x, y]]) => [x / 480, y / 800]));
  probes.forEach(([, color], i) => expectColor(preview[i]!, color, 24));

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-one').click()]);
  expect(download.suggestedFilename()).toBe('IMG_0001.png');
  const bytes = await downloadBytes(download);
  const d = await decodeInPage(page, bytes, 'image/png', probes.map(([p]) => p));
  expect([d.width, d.height]).toEqual([480, 800]);
  for (const [p, color] of probes) expectColor(d.at(...p), color, 24);
  // The export is a fresh PNG: no HEIC data or EXIF from the source.
  expect(bytes.includes(Buffer.from('ftyp'))).toBe(false);
  expect(bytes.includes(Buffer.from('Exif'))).toBe(false);
  expect(bytes.includes(Buffer.from('InkDoze test fixture'))).toBe(false);

  if (expectedDecoder(info) === 'native') expect([t.started, t.chunkLoads]).toEqual([0, 0]);
  else {
    expect(t.chunkLoads).toBe(1);
    expect(t.started).toBeLessThanOrEqual(1);
  }
});

test('HEIC with an empty MIME type and no extension', async ({ page }, info) => {
  await addFiles(page, [heic('photo', SMALL, '')]);
  await waitReady(page, 1);
  await expect(page.locator('.file-item')).toContainText('600 × 800');
  await expect(page.locator('.file-item')).toHaveAttribute('data-decoder', expectedDecoder(info));
});

test('mixed batch: each failure is reported on its file and the rest still converts', async ({ page }) => {
  const avif = replaceBytes(replaceBytes(SMALL, [...Buffer.from('ftypheic')], [...Buffer.from('ftypavif')]), [...Buffer.from('hvc1')], [...Buffer.from('av01')]);
  const jpegInHeif = replaceBytes(SMALL, [...Buffer.from('hvc1')], [...Buffer.from('jpeg')]);
  await addFiles(page, [
    { name: 'a.png', mimeType: 'image/png', buffer: quadrants(80, 40) },
    heic('b.heic', SMALL),
    heic('cut.heic', SMALL.subarray(0, 900)),
    heic('fake.avif', avif, 'image/avif'),
    heic('jpeg-in-heif.heif', jpegInHeif, 'image/heif'),
    heic('big.heic', bigGrid()),
    { name: 'c.png', mimeType: 'image/png', buffer: makePng(30, 60, () => [10, 20, 30, 255]) },
  ]);
  const items = page.locator('.file-item');
  await expect(items).toHaveCount(7);
  await expect(items.nth(2)).toContainText('The file is damaged or incomplete.');
  await expect(items.nth(3)).toContainText('Not a PNG, JPEG, WebP or HEIC image.');
  await expect(items.nth(4)).toContainText('This HEIC/HEIF variant is not supported.');
  await expect(items.nth(5)).toContainText('Image is 6048x8064; the limit is 40 megapixels.');
  for (const i of [0, 1, 6]) await expect(items.nth(i)).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
  expect(readZip(await downloadBytes(zip)).map((f) => f.name).sort()).toEqual(['a.bmp', 'b.bmp', 'c.bmp']);
});

test('a large composite image is rejected before any decoder runs', async ({ page, context }) => {
  const t = track(page, context);
  await addFiles(page, [heic('big.heic', bigGrid())]);
  await expect(page.locator('.file-item')).toContainText('Image is 6048x8064; the limit is 40 megapixels.');
  expect([t.started, t.chunkLoads]).toEqual([0, 0]);
});

test('damaged HEVC data in a valid container is reported as damaged', async ({ page }, info) => {
  test.skip(expectedDecoder(info) === 'native', 'The system decoder may render damaged data instead of failing.');
  await addFiles(page, [heic('damaged.heic', damagedData()), heic('ok.heic', SMALL)]);
  const items = page.locator('.file-item');
  await expect(items.nth(0)).toContainText('The file is damaged or incomplete.', { timeout: 20_000 });
  await expect(items.nth(1)).toHaveAttribute('data-status', 'ready');
});

test('PNG, JPEG and WebP never load the HEIC decoder', async ({ page, context }) => {
  const t = track(page, context);
  await addFiles(page, [
    { name: 'a.png', mimeType: 'image/png', buffer: quadrants(80, 40) },
    { name: 'b.jpg', mimeType: 'image/jpeg', buffer: await encodeInPage(page, 'image/jpeg', 120, 80) },
    { name: 'c.webp', mimeType: 'image/webp', buffer: fixture('sample.webp') },
  ]);
  await waitReady(page, 3);
  await waitPreview(page, '480 × 800');
  expect([t.started, t.chunkLoads]).toEqual([0, 0]);
  expect(t.requests.filter((u) => DECODER_FILES.test(u))).toEqual([]);
});

test('the WebAssembly fallback loads once, from the app only, and is reused', async ({ page, context }, info) => {
  test.skip(expectedDecoder(info) === 'native', 'This engine decodes HEIC itself.');
  const t = track(page, context);
  const before = t.requests.length;
  await addFiles(page, [heic('one.heic', SMALL), heic('two.heic', IPHONE), heic('three.heic', SMALL)]);
  await waitReady(page, 3);
  for (const i of [0, 1, 2]) await expect(page.locator('.file-item').nth(i)).toHaveAttribute('data-decoder', 'wasm');
  // One decoder worker and one chunk load serve all three photos.
  expect(t.chunkLoads).toBe(1);
  expect(t.started).toBeLessThanOrEqual(1);
  expect(t.stopped).toBe(0);
  // Nothing but the decoder files, from the app's own directory.
  const after = t.requests.slice(before).filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
  expect(after.length).toBeGreaterThan(0);
  for (const u of after) {
    expect(DECODER_FILES.test(u), u).toBe(true);
    expect(new URL(u).origin + new URL(u).pathname.replace(/[^/]+$/, '')).toBe(new URL('./assets/', page.url()).href);
  }
});

test('when the decoder cannot be loaded, HEIC fails clearly and other files still work', async ({ page, context }, info) => {
  test.skip(expectedDecoder(info) === 'native', 'This engine decodes HEIC itself.');
  await context.route(/libheif-bundle-/, (route) => route.abort());
  await addFiles(page, [heic('a.heic', SMALL), { name: 'b.png', mimeType: 'image/png', buffer: quadrants(80, 40) }]);
  const items = page.locator('.file-item');
  await expect(items.nth(0)).toContainText('The HEIC decoder could not be loaded.', { timeout: 20_000 });
  await expect(items.nth(1)).toHaveAttribute('data-status', 'ready');
  // A later attempt starts a new decoder once loading works again.
  await context.unroute(/libheif-bundle-/);
  await addFiles(page, [heic('c.heic', SMALL)]);
  await expect(items.nth(2)).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
});

test('removing a HEIC while it decodes drops its result', async ({ page, context }, info) => {
  test.skip(expectedDecoder(info) === 'native', 'Native decoding finishes too fast to remove the file midway.');
  const t = track(page, context);
  // Hold the decoder chunk so the photo is still decoding when it is removed. The held
  // request is then aborted: its worker no longer exists.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await context.route(/libheif-bundle-/, async (route) => {
    await held;
    await route.abort().catch(() => undefined);
  });
  await addFiles(page, [heic('slow.heic', IPHONE)]);
  const item = page.locator('.file-item');
  await expect(item).toHaveAttribute('data-status', 'loading');
  await expect.poll(() => t.chunkLoads).toBe(1);
  await page.getByRole('button', { name: 'Remove slow.heic' }).click();
  await expect(item).toHaveCount(0);
  release();
  await context.unroute(/libheif-bundle-/);

  // The decoder working on the removed photo was shut down: a live one would be reused,
  // so the next photo starting a second decoder worker shows the first one is gone.
  // (Firefox does not report the close event of a nested worker; WebKit on Linux
  // reports no nested worker events, so the check runs where they are reported.)
  await addFiles(page, [heic('next.heic', SMALL)]);
  await waitReady(page, 1);
  await expect(page.locator('.file-item')).toHaveCount(1);
  await expect(page.locator('.file-item')).toContainText('600 × 800');
  if (t.started > 0) expect(t.started).toBe(2);
  // The removed photo never comes back.
  await page.waitForTimeout(1500);
  await expect(page.locator('.file-item')).toHaveCount(1);
});
