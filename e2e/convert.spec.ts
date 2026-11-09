import { expect, test, type Page } from '@playwright/test';
import {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  addFiles,
  bmpPixel,
  decodeInPage,
  downloadBytes,
  encodeInPage,
  expectColor,
  expectGray,
  luma,
  makePng,
  parseBmp,
  quadrants,
  readZip,
  withLargeExif,
  waitPreview,
  waitReady,
} from './helpers.ts';

const png = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/png', buffer });

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('inkdoze.locale', 'en'));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'InkDoze' })).toBeVisible();
}

async function setFormat(page: Page, value: string) {
  await page.getByTestId('format').selectOption(value);
}

async function downloadOne(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-one').click()]);
  return { name: download.suggestedFilename(), bytes: await downloadBytes(download) };
}

test.describe('single image', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('Xteink X4 default: 480×800 BMP for CrossPoint with correct fill crop', async ({ page }) => {
    await addFiles(page, [png('quadrants.png', quadrants())]);
    await waitReady(page, 1);
    await waitPreview(page, '480 × 800');
    await expect(page.getByTestId('install-method')).toHaveAttribute('data-method', 'crosspoint');
    await expect(page.locator('.file-name-preview code')).toHaveText('quadrants.bmp');

    const { name, bytes } = await downloadOne(page);
    expect(name).toBe('quadrants.bmp');
    const h = parseBmp(bytes);
    expect([h.width, h.height, h.bpp, h.compression, h.fileSize]).toEqual([480, 800, 24, 0, bytes.length]);

    // Fill: 400×200 scaled ×4 → 1600×800, centred. Visible x range in source: 140..260.
    // Left half of output shows the left quadrants, right half the right quadrants.
    const d = await decodeInPage(page, bytes, 'image/bmp', [
      [100, 200],
      [380, 200],
      [100, 600],
      [380, 600],
    ]);
    expect([d.width, d.height]).toEqual([480, 800]);
    expectGray(d.at(100, 200), luma(RED), 3);
    expectGray(d.at(380, 200), luma(GREEN), 3);
    expectGray(d.at(100, 600), luma(BLUE), 3);
    expectGray(d.at(380, 600), luma(YELLOW), 3);
    // Our own reading of the file agrees with the browser's decoder.
    expect(bmpPixel(bytes, h, 100, 200)).toBe(d.at(100, 200)[1]);
  });

  test('rotation, original size and colour PNG', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await page.getByRole('radio', { name: 'Original' }).check({ force: true });
    await page.getByRole('radio', { name: 'Colour', exact: true }).last().check({ force: true });
    await setFormat(page, 'png');
    await page.getByRole('button', { name: 'Rotate right' }).click();
    await waitPreview(page, '200 × 400');

    const { name, bytes } = await downloadOne(page);
    expect(name).toBe('q.png');
    const d = await decodeInPage(page, bytes, 'image/png', [
      [50, 50],
      [150, 50],
      [50, 350],
      [150, 350],
    ]);
    expect([d.width, d.height]).toEqual([200, 400]);
    // Clockwise: top-left ← bottom-left (blue), top-right ← top-left (red),
    // bottom-left ← bottom-right (yellow), bottom-right ← top-right (green).
    expectColor(d.at(50, 50), BLUE);
    expectColor(d.at(150, 50), RED);
    expectColor(d.at(50, 350), YELLOW);
    expectColor(d.at(150, 350), GREEN);
  });

  test('transparent areas and letterbox use the background colour', async ({ page }) => {
    // 100×50 transparent image with an opaque red 20×20 square in the centre.
    const img = makePng(100, 50, (x, y) => (x >= 40 && x < 60 && y >= 15 && y < 35 ? RED : [0, 0, 255, 0]));
    await addFiles(page, [png('alpha.png', img)]);
    await waitReady(page, 1);
    await page.getByRole('radio', { name: 'Custom', exact: true }).last().check({ force: true });
    await page.getByTestId('custom-width').fill('200');
    await page.getByTestId('custom-width').press('Tab');
    await page.getByTestId('custom-height').fill('300');
    await page.getByTestId('custom-height').press('Tab');
    await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });
    await page.getByRole('radio', { name: 'Colour', exact: true }).last().check({ force: true });
    await page.getByRole('button', { name: 'Black', exact: true }).click();
    await setFormat(page, 'png');
    await waitPreview(page, '200 × 300');

    const { bytes } = await downloadOne(page);
    const d = await decodeInPage(page, bytes, 'image/png', [
      [5, 5],
      [100, 20],
      [100, 150],
      [10, 150],
      [195, 295],
    ]);
    expect([d.width, d.height]).toEqual([200, 300]);
    expectColor(d.at(5, 5), [0, 0, 0]); // letterbox
    expectColor(d.at(100, 20), [0, 0, 0]); // letterbox above the image
    expectColor(d.at(100, 150), RED); // opaque square in the centre
    expectColor(d.at(10, 150), [0, 0, 0]); // transparent pixel → background, not blue
    expect(d.at(10, 150)[3]).toBe(255);
    expectColor(d.at(195, 295), [0, 0, 0]);
  });

  test('crop with locked aspect, moved with the keyboard', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await page.getByRole('radio', { name: 'Custom', exact: true }).last().check({ force: true });
    await page.getByTestId('custom-width').fill('100');
    await page.getByTestId('custom-width').press('Tab');
    await page.getByTestId('custom-height').fill('100');
    await page.getByTestId('custom-height').press('Tab');
    await page.getByRole('radio', { name: 'Colour', exact: true }).last().check({ force: true });
    await setFormat(page, 'png');
    await waitPreview(page, '100 × 100');

    const cropButton = page.getByRole('button', { name: 'Crop', exact: true });
    await cropButton.click();
    const rect = page.getByTestId('crop-rect');
    await expect(rect).toBeVisible();
    // Locked to 1:1 on a 2:1 image: a centred square covering x 0.25..0.75.
    await rect.focus();
    for (let i = 0; i < 30; i++) await rect.press('ArrowLeft'); // clamps at the left edge
    await page.getByTestId('crop-apply').click();
    await expect(page.locator('.tag', { hasText: 'Cropped' })).toBeVisible();
    // Focus returns to the control that opened the dialog.
    await expect(cropButton).toBeFocused();

    const { bytes } = await downloadOne(page);
    const d = await decodeInPage(page, bytes, 'image/png', [
      [10, 20],
      [90, 20],
      [10, 80],
      [90, 80],
    ]);
    // Crop = left half of the source (a square): top red, bottom blue, no green or yellow.
    expectColor(d.at(10, 20), RED);
    expectColor(d.at(90, 20), RED);
    expectColor(d.at(10, 80), BLUE);
    expectColor(d.at(90, 80), BLUE);
  });

  test('paletted BMP variants have the right depth, palette and packing', async ({ page }) => {
    // Horizontal gray ramp, 16 px wide steps.
    const ramp = makePng(64, 8, (x) => {
      const v = Math.round((x / 63) * 255);
      return [v, v, v, 255];
    });
    await addFiles(page, [png('ramp.png', ramp)]);
    await waitReady(page, 1);
    await page.getByRole('radio', { name: 'Original' }).check({ force: true });

    const cases: Array<[string, number, number[]]> = [
      ['bmp1', 1, [0, 255]],
      ['bmp2', 2, [0, 85, 170, 255]],
      ['bmp4', 4, Array.from({ length: 16 }, (_, i) => i * 17)],
      ['bmp8', 8, Array.from({ length: 256 }, (_, i) => i)],
    ];
    for (const [format, bpp, palette] of cases) {
      await setFormat(page, format);
      await waitPreview(page, '64 × 8');
      const { name, bytes } = await downloadOne(page);
      expect(name).toBe('ramp.bmp');
      const h = parseBmp(bytes);
      expect([h.width, h.height, h.bpp, h.compression], format).toEqual([64, 8, bpp, 0]);
      expect(h.palette, format).toEqual(palette);
      expect(bytes.length).toBe(h.offset + h.stride * 8);
      // Ramp endpoints are black and white in every variant.
      expect(bmpPixel(bytes, h, 0, 3), format).toBe(0);
      expect(bmpPixel(bytes, h, 63, 3), format).toBe(255);
      // Values are monotonic along the ramp.
      let last = -1;
      for (let x = 0; x < 64; x++) {
        const v = bmpPixel(bytes, h, x, 4);
        expect(v, `${format} x=${x}`).toBeGreaterThanOrEqual(last);
        last = v;
      }
      if (bpp !== 2) {
        // Chromium's BMP decoder reads 1/4/8-bit files; values must match ours.
        const d = await decodeInPage(page, bytes, 'image/bmp', [
          [0, 0],
          [32, 4],
          [63, 7],
        ]);
        expect([d.width, d.height]).toEqual([64, 8]);
        expectGray(d.at(32, 4), bmpPixel(bytes, h, 32, 4), 0);
      }
    }
  });

  test('device search changes the output size and install guide', async ({ page }) => {
    await page.getByRole('searchbox').fill('pw5');
    await expect(page.locator('[data-device]')).toHaveCount(1);
    await page.locator('[data-device="kindle-paperwhite-5"]').click();
    await expect(page.getByTestId('device-resolution')).toContainText('1236 × 1648');
    await expect(page.getByTestId('install-guide')).toContainText('Book cover only');

    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await waitPreview(page, '1236 × 1648');
    const { name, bytes } = await downloadOne(page);
    expect(name).toBe('q.png');
    const d = await decodeInPage(page, bytes, 'image/png', [[600, 800]]);
    expect([d.width, d.height]).toEqual([1236, 1648]);
  });

  test('accepts JPEG photos whose metadata is larger than the first read', async ({ page }) => {
    const photo = withLargeExif(await encodeInPage(page, 'image/jpeg', 300, 500), 140_000);
    await addFiles(page, [{ name: 'phone-photo.jpg', mimeType: 'image/jpeg', buffer: photo }]);
    await waitReady(page, 1);
    await expect(page.locator('.file-item').first()).toContainText('300 × 500');
    await waitPreview(page, '480 × 800');
  });

  test('decoding errors appear next to the file', async ({ page }) => {
    await addFiles(page, [
      { name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('this is not an image') },
      { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.concat([quadrants().subarray(0, 60), Buffer.alloc(40)]) },
      png('good.png', quadrants(40, 20)),
    ]);
    const items = page.locator('.file-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Not a PNG, JPEG or WebP image.');
    await expect(items.nth(1)).toContainText(/could not decode|header is damaged/);
    await expect(items.nth(2)).toHaveAttribute('data-status', 'ready');
    await expect(items.nth(2).locator('.file-error')).toHaveCount(0);
  });

  test('limits the number of files', async ({ page }) => {
    const tiny = quadrants(4, 2);
    await addFiles(
      page,
      Array.from({ length: 42 }, (_, i) => png(`t${i}.png`, tiny)),
    );
    await expect(page.locator('.file-item')).toHaveCount(40);
    await expect(page.locator('.files-panel .callout.warn')).toContainText('2 skipped');
  });
});

test.describe('batch', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('ZIP with renamed files, per-file settings and mixed inputs', async ({ page }) => {
    const jpeg = await encodeInPage(page, 'image/jpeg', 300, 500);
    const webp = await encodeInPage(page, 'image/webp', 500, 300);
    await addFiles(page, [
      png('first.png', quadrants()),
      { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpeg },
      { name: 'art.webp', mimeType: 'image/webp', buffer: webp },
    ]);
    await waitReady(page, 3);

    // Rename the first file to the CrossPoint single-image name.
    const first = page.locator('.file-item').nth(0);
    await first.locator('.name-input').fill('sleep');
    await first.locator('.name-input').press('Tab');

    // Give only the third image its own settings: PNG and stretch.
    await page.locator('.file-item').nth(2).locator('.thumb').click();
    await page.getByRole('radio', { name: 'This image only' }).check({ force: true });
    await setFormat(page, 'png');
    await page.getByRole('radio', { name: 'Stretch' }).check({ force: true });
    await expect(page.getByTestId('scope-note')).toContainText('art.webp');
    await expect(page.locator('.file-item').nth(2).locator('.tag', { hasText: 'Own settings' })).toBeVisible();
    await expect(page.locator('.file-item').nth(0).locator('.tag', { hasText: 'Own settings' })).toHaveCount(0);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
    expect(download.suggestedFilename()).toBe('inkdoze-xteink-x4.zip');
    const files = readZip(await downloadBytes(download));
    expect(files.map((f) => f.name)).toEqual(['sleep.bmp', 'photo.bmp', 'art.png']);

    for (const f of files) {
      const mime = f.name.endsWith('.png') ? 'image/png' : 'image/bmp';
      const d = await decodeInPage(page, f.data, mime, [[240, 400]]);
      expect([d.width, d.height], f.name).toEqual([480, 800]);
    }
    expect(parseBmp(files[0]!.data).bpp).toBe(24);
    // Stretch maps the whole webp (blue frame, light centre) onto the screen: the centre is light.
    const art = await decodeInPage(page, files[2]!.data, 'image/png', [
      [240, 400],
      [10, 10],
    ]);
    expect(luma(art.at(240, 400))).toBeGreaterThan(180);
    expect(luma(art.at(10, 10))).toBeLessThan(90);
    await expect(page.getByTestId('download-message')).toContainText('inkdoze-xteink-x4.zip');
  });

  test('cancelling a batch stops the download', async ({ page }) => {
    await page.locator('[data-device="boox-note-max"]').scrollIntoViewIfNeeded();
    await page.locator('[data-device="boox-note-max"]').click();
    const big = quadrants(1600, 800);
    await addFiles(page, Array.from({ length: 8 }, (_, i) => png(`big${i}.png`, big)));
    await waitReady(page, 8);
    await setFormat(page, 'bmp24');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await page.getByTestId('download-all').click();
    await page.getByTestId('download-cancel').click();
    await expect(page.getByTestId('download-message')).toHaveText('Download cancelled.');
    expect(downloaded).toBe(false);
    await expect(page.getByTestId('download-all')).toBeEnabled();
  });
});

test('works offline after the app has loaded and never contacts other hosts', async ({ page, context }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await open(page);
  const loaded = requests.length;
  await context.setOffline(true);

  await addFiles(page, [png('offline.png', quadrants())]);
  await waitReady(page, 1);
  await waitPreview(page, '480 × 800');
  const { bytes } = await downloadOne(page);
  expect(parseBmp(bytes).width).toBe(480);
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
  expect(readZip(await downloadBytes(zip))).toHaveLength(1);

  const after = requests.slice(loaded).filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
  expect(after).toEqual([]);
  for (const u of requests) {
    if (u.startsWith('blob:') || u.startsWith('data:')) continue;
    expect(new URL(u).hostname).toBe('127.0.0.1');
  }
});
