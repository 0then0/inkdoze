import { inflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { addFiles, decodeInPage, downloadBytes, expectGray, makePng, readZip, waitReady, type Rgba } from './helpers.ts';

type PreviewTestWindow = Window & { testPngs: Map<string, Blob> };

function paeth(left: number, up: number, upperLeft: number): number {
  const prediction = left + up - upperLeft;
  const dl = Math.abs(prediction - left);
  const du = Math.abs(prediction - up);
  const dul = Math.abs(prediction - upperLeft);
  if (dl <= du && dl <= dul) return left;
  return du <= dul ? up : upperLeft;
}

/** Decode the downloaded non-interlaced 8-bit RGBA PNG independently of Canvas. */
function decodeRgbaPng(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from('89504e470d0a1a0a', 'hex'));
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect([...png.subarray(24, 29)]).toEqual([8, 6, 0, 0, 0]);
  const chunks: Buffer[] = [];
  for (let i = 8; i < png.length; ) {
    const size = png.readUInt32BE(i);
    if (png.toString('ascii', i + 4, i + 8) === 'IDAT') chunks.push(png.subarray(i + 8, i + 8 + size));
    i += 12 + size;
  }
  const filtered = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  expect(filtered.length).toBe((stride + 1) * height);
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = filtered[start]!;
    if (filter > 4) throw new Error(`Unknown PNG filter: ${filter}`);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= 4 ? rgba[i - 4]! : 0;
      const up = y > 0 ? rgba[i - stride]! : 0;
      const upperLeft = x >= 4 && y > 0 ? rgba[i - stride - 4]! : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = (left + up) >> 1;
      if (filter === 4) predictor = paeth(left, up, upperLeft);
      rgba[i] = (filtered[start + x + 1]! + predictor) & 255;
    }
  }
  return {
    width,
    height,
    rgba,
    at: (x: number, y: number) => [...rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)] as Rgba,
  };
}

function fixture(hiddenRgb: Rgba) {
  const buffer = makePng(800, 400, (x) => {
    if (x < 267) return hiddenRgb;
    // Black stays exact under premultiplied rounding at the resampled edge.
    if (x < 300) return [0, 0, 0, 128];
    if (x < 533) return [64, 64, 64, 128];
    return [255, 255, 255, 255];
  });
  return { buffer, name: 'alpha.png', mimeType: 'image/png' };
}

async function downloadOne(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-one').click()]);
  return { name: download.suggestedFilename(), bytes: await downloadBytes(download) };
}

async function positionOverlay(page: Page) {
  await page.getByRole('button', { name: 'Rotate right' }).click();
  await page.getByLabel('Zoom', { exact: true }).fill('0.5');
  await page.locator('#offset-x').fill('1');
}

async function expectAlignedPreview(page: Page) {
  const image = await page.getByTestId('overlay-preview-image').boundingBox();
  const backdrop = await page.getByTestId('overlay-preview-page').boundingBox();
  if (!image || !backdrop) throw new Error('Expected the overlay and its sample page to be visible');
  for (const edge of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(image[edge] - backdrop[edge]), edge).toBeLessThan(0.5);
  }
  return image;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
    // The app's CSP allows blob URLs for images but blocks fetch. Record the
    // blobs here so the test can independently decode the already displayed PNG.
    const pngs = new Map<string, Blob>();
    (window as unknown as PreviewTestWindow).testPngs = pngs;
    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
      const url = createObjectURL(blob);
      if (blob instanceof Blob && blob.type === 'image/png') pngs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      pngs.delete(url);
      revokeObjectURL(url);
    };
  });
  await page.goto('./');
});

test('CrossPoint PNG keeps the placed alpha, matches the preview and restores standard export settings', async ({ page }) => {
  await addFiles(page, [fixture([255, 0, 0, 0])]);
  await waitReady(page, 1);
  await page.getByRole('radio', { name: 'Custom', exact: true }).last().check({ force: true });
  await page.getByTestId('custom-width').fill('200');
  await page.getByTestId('custom-height').fill('300');
  await page.getByTestId('custom-height').press('Tab');
  await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByTestId('auto-tone').uncheck();
  await page.getByTestId('format').selectOption('png');

  const mode = page.getByTestId('output-mode');
  await mode.selectOption('crosspoint-overlay');
  await expect(page.getByTestId('overlay-preview-page')).toBeVisible();
  await expect(page.getByTestId('install-method')).toHaveAttribute('data-method', 'crosspoint-overlay');
  await expect(page.getByTestId('install-method')).toContainText('/.sleep-overlay/');
  await expect(page.getByTestId('install-method')).toContainText('sleep-overlay.bmp');
  await expect(page.getByTestId('download-all')).toBeEnabled();
  await expect(page.getByTestId('auto-tone')).toHaveCount(0);
  await positionOverlay(page);
  const { name, bytes } = await downloadOne(page);
  expect(name).toBe('sleep-overlay.png');
  const png = decodeRgbaPng(bytes);
  expect([png.width, png.height]).toEqual([480, 800]);
  // Clockwise rotation makes the columns rows. At 50% the image occupies x 280..479, y 200..599.
  expect(png.at(350, 250)).toEqual([0, 0, 0, 0]); // fully transparent input
  expectGray(png.at(350, 400), 64, 2); // unpremultiplication can round RGB differently between engines
  expect(png.at(350, 400)[3]).toBe(128);
  expect(png.at(350, 550)).toEqual([255, 255, 255, 255]);
  expect(png.at(279, 400)).toEqual([0, 0, 0, 0]); // left of the placement
  expect(png.at(350, 199)).toEqual([0, 0, 0, 0]); // above the placement
  expect(png.at(350, 600)).toEqual([0, 0, 0, 0]); // below the placement
  const edge = png.at(350, 333);
  expect(edge.slice(0, 3)).toEqual([0, 0, 0]);
  expect(edge[3]).toBeGreaterThan(0);
  expect(edge[3]).toBeLessThan(128);

  const preview = page.getByTestId('overlay-preview-image');
  const previewBytes = await preview.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    const blob = (window as unknown as PreviewTestWindow).testPngs.get(element.src);
    if (!blob) throw new Error('Preview PNG blob was not recorded');
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  const previewPng = decodeRgbaPng(Buffer.from(previewBytes));
  expect([previewPng.width, previewPng.height]).toEqual([png.width, png.height]);
  expect(previewPng.rgba.equals(png.rgba)).toBe(true);

  await expectAlignedPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await expectAlignedPreview(page);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);

  // Replace only RGB under alpha = 0. Downsampling must give the same visible edge.
  await page.getByRole('button', { name: 'Remove alpha.png', exact: true }).click();
  await addFiles(page, [fixture([0, 255, 0, 0])]);
  await waitReady(page, 1);
  await positionOverlay(page);
  const other = decodeRgbaPng((await downloadOne(page)).bytes);
  expect(other.rgba.equals(png.rgba)).toBe(true);

  await mode.selectOption('standard');
  await expect(page.getByTestId('overlay-preview-page')).toHaveCount(0);
  const ordinary = await downloadOne(page);
  expect(ordinary.name).toBe('alpha.png');
  const decoded = await decodeInPage(page, ordinary.bytes, 'image/png', [[10, 150], [160, 90], [160, 150], [160, 195]]);
  expect([decoded.width, decoded.height]).toEqual([200, 300]);
  expect(decoded.at(10, 150)).toEqual([0, 0, 0, 255]);
  expect(decoded.at(160, 90)[3]).toBe(255);
  expect(decoded.at(160, 150)[3]).toBe(255);
  expect(decoded.at(160, 195)).toEqual([255, 255, 255, 255]);
});

test('overlay ZIP contains ready images with unique names and their individual framing', async ({ page }) => {
  const source = fixture([255, 0, 0, 0]);
  await addFiles(page, [source, { ...source, name: 'ALPHA.PNG' }, { ...source, name: 'detail.png' }, { ...source, name: 'broken.png', buffer: Buffer.from([0]) }]);
  await waitReady(page, 3);
  await expect(page.locator('.file-item[data-status="error"]')).toHaveCount(1);
  await page.getByTestId('output-mode').selectOption('crosspoint-overlay');
  await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });

  await page.getByRole('button', { name: 'Select detail.png', exact: true }).click();
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByTestId('crop-rect').press('ArrowRight');
  await page.getByTestId('crop-apply').click();
  await expect(page.locator('.file-item.selected')).toContainText('Cropped');
  await positionOverlay(page);
  const single = decodeRgbaPng((await downloadOne(page)).bytes);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download overlay ZIP' }).click()]);
  expect(download.suggestedFilename()).toBe('inkdoze-xteink-x4-overlays.zip');
  const files = readZip(await downloadBytes(download));
  expect(files.map(({ name }) => name)).toEqual(['.sleep-overlay/alpha.png', '.sleep-overlay/ALPHA-2.png', '.sleep-overlay/detail.png']);
  const pngs = files.map(({ data }) => decodeRgbaPng(data));
  for (const png of pngs) expect([png.width, png.height]).toEqual([480, 800]);
  const [first, second, detail] = pngs;
  expect(first!.at(10, 10)).toEqual([0, 0, 0, 0]);
  expect(first!.at(240, 400)[3]).toBe(128);
  expect(first!.at(440, 400)).toEqual([255, 255, 255, 255]);
  expect(second!.rgba.equals(first!.rgba)).toBe(true);
  expect(detail!.rgba.equals(first!.rgba)).toBe(false);
  expect(detail!.rgba.equals(single.rgba)).toBe(true);
});

test('overlay ZIP reports failures when no ready image can be rendered', async ({ page }) => {
  const source = fixture([255, 0, 0, 0]);
  await addFiles(page, [source, { ...source, name: 'other.png' }]);
  await waitReady(page, 2);
  await page.getByTestId('output-mode').selectOption('crosspoint-overlay');
  await expect(page.getByTestId('download-one')).toBeEnabled();
  await page.evaluate(() => {
    const send = Worker.prototype.postMessage;
    let remaining = 2;
    Worker.prototype.postMessage = function (this: Worker, request: { type: string }, ...args: unknown[]) {
      if (request.type !== 'export') return Reflect.apply(send, this, [request, ...args]);
      if (--remaining === 0) Worker.prototype.postMessage = send;
      return Reflect.apply(send, this, [{ ...request, imageId: 'missing' }, ...args]);
    };
  });

  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  const batch = page.getByTestId('download-all');
  await batch.click();
  await expect(page.getByTestId('download-message')).toHaveText('2 images failed and were skipped.');
  await Promise.all([page.waitForEvent('download'), batch.click()]);
  expect(downloads).toEqual(['inkdoze-xteink-x4-overlays.zip']);
});

test('a failed overlay preview does not show the previously selected image', async ({ page }) => {
  await addFiles(page, [fixture([255, 0, 0, 0]), { ...fixture([0, 0, 0, 0]), name: 'second.png' }]);
  await waitReady(page, 2);
  await page.getByTestId('output-mode').selectOption('crosspoint-overlay');
  const preview = page.getByTestId('overlay-preview-image');
  await expect(preview).toBeVisible();

  await page.evaluate(() => {
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, request: { type?: string }, ...args: unknown[]) {
      if (request.type !== 'export') return Reflect.apply(send, this, [request, ...args]);
      Worker.prototype.postMessage = send;
      send.call(this, { ...request, imageId: 'missing' });
    };
  });
  await page.getByRole('button', { name: 'Select second.png', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Rendering failed.');
  await expect(preview).toHaveCount(0);
  await expect(page.getByTestId('download-one')).toBeDisabled();

  await page.getByRole('button', { name: 'Select alpha.png', exact: true }).click();
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('download-one')).toBeEnabled();
});

test('cancelling the overlay export discards the worker result', async ({ page }) => {
  await addFiles(page, [fixture([255, 0, 0, 0])]);
  await waitReady(page, 1);
  await page.getByTestId('output-mode').selectOption('crosspoint-overlay');
  await expect(page.getByTestId('overlay-preview-image')).toBeVisible();
  await page.evaluate(() => {
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, request: { type?: string; reqId?: number }, ...args: unknown[]) {
      if (request.type !== 'export') return Reflect.apply(send, this, [request, ...args]);
      Worker.prototype.postMessage = send;
      // Hold the request until cancellation, then wait for the actual worker reply.
      document.addEventListener('resume-worker-export', (event) => {
        const done = (event as CustomEvent<() => void>).detail;
        const receive = (reply: MessageEvent<{ reqId: number }>) => {
          if (reply.data.reqId !== request.reqId) return;
          this.removeEventListener('message', receive);
          done();
        };
        this.addEventListener('message', receive);
        send.call(this, request);
      }, { once: true });
    };
  });
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByTestId('download-one').click();
  await page.getByTestId('download-cancel').click();
  await expect(page.getByTestId('download-message')).toHaveText('Download cancelled.');
  await page.evaluate(() => new Promise<void>((done) => document.dispatchEvent(new CustomEvent('resume-worker-export', { detail: done }))));
  await downloadOne(page);
  expect(downloads).toEqual(['sleep-overlay.png']);
});
