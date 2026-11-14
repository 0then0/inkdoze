import { expect, test, type Page } from '@playwright/test';
import { BLUE, RED, addFiles, decodeInPage, downloadBytes, expectGray, luma, quadrants, readZip, selectDevice, waitPreview, waitReady } from './helpers.ts';

const png = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/png', buffer });

/**
 * Test hooks around the render worker: `hold` parks export requests until `release()`,
 * `fail` sends them for an image the worker does not have, which makes the real worker
 * answer with an error. Nothing else in the app is changed.
 */
async function open(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
    const orig = Worker.prototype.postMessage;
    const held: Array<[Worker, unknown]> = [];
    const hooks = {
      hold: false,
      fail: false,
      exports: 0,
      release() {
        for (const [w, m] of held.splice(0)) orig.call(w, m);
      },
    };
    (window as unknown as { epubTest: typeof hooks }).epubTest = hooks;
    Worker.prototype.postMessage = function (this: Worker, msg: unknown, ...rest: unknown[]) {
      const m = msg as { type?: string; imageId?: string };
      if (m?.type === 'export') {
        hooks.exports++;
        const out = hooks.fail ? { ...m, imageId: 'missing-image' } : m;
        if (hooks.hold) {
          held.push([this, out]);
          return;
        }
        return orig.call(this, out);
      }
      return (orig as (...a: unknown[]) => void).call(this, msg, ...rest);
    } as typeof Worker.prototype.postMessage;
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'InkDoze' })).toBeVisible();
}

const hooks = (page: Page, patch: { hold?: boolean; fail?: boolean }) =>
  page.evaluate((p) => Object.assign((window as unknown as { epubTest: object }).epubTest, p), patch);
const release = (page: Page) => page.evaluate(() => (window as unknown as { epubTest: { release: () => void } }).epubTest.release());
const exportCount = (page: Page) => page.evaluate(() => (window as unknown as { epubTest: { exports: number } }).epubTest.exports);

async function download(page: Page, testId: string) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  return { name: d.suggestedFilename(), bytes: await downloadBytes(d) };
}

interface EpubInfo {
  errors: string[];
  rootfile: string;
  title: string;
  language: string;
  identifier: string;
  modified: string;
  legacyCover: string;
  coverHref: string;
  coverType: string;
  navHref: string;
  spine: string[];
  tocLinks: string[];
  pageImage: string;
  pageAlt: string;
  scripts: number;
}

/** Parse every XML document with the browser's XML parser and follow the references. */
async function inspectEpub(page: Page, files: Array<{ name: string; data: Buffer }>): Promise<EpubInfo> {
  const docs = Object.fromEntries(files.filter((f) => /\.(xml|opf|xhtml)$/.test(f.name)).map((f) => [f.name, f.data.toString('utf8')]));
  return page.evaluate((docs) => {
    const errors: string[] = [];
    const parse = (name: string) => {
      const text = docs[name];
      if (text === undefined) {
        errors.push(`missing ${name}`);
        return new Document();
      }
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) errors.push(`${name} is not well-formed`);
      return doc;
    };
    for (const name of Object.keys(docs)) parse(name);
    const container = parse('META-INF/container.xml');
    const rootfile = container.querySelector('rootfile')?.getAttribute('full-path') ?? '';
    const opf = parse(rootfile);
    const dir = rootfile.slice(0, rootfile.lastIndexOf('/') + 1);
    const DC = 'http://purl.org/dc/elements/1.1/';
    const dc = (n: string) => opf.getElementsByTagNameNS(DC, n)[0]?.textContent ?? '';
    const pkg = opf.documentElement;
    const uid = pkg.getAttribute('unique-identifier');
    const identifierEl = opf.getElementsByTagNameNS(DC, 'identifier')[0];
    if (!uid || identifierEl?.getAttribute('id') !== uid) errors.push('unique-identifier does not match dc:identifier');
    const items = [...opf.querySelectorAll('manifest > item')];
    const byId = new Map(items.map((i) => [i.getAttribute('id'), i]));
    for (const i of items) if (!(dir + i.getAttribute('href') in docs) && !/image\//.test(i.getAttribute('media-type') ?? '')) errors.push(`dangling ${i.getAttribute('href')}`);
    const cover = items.filter((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('cover-image'));
    const nav = items.filter((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('nav'));
    if (cover.length !== 1) errors.push('expected one cover-image item');
    if (nav.length !== 1) errors.push('expected one nav item');
    const spine = [...opf.querySelectorAll('spine > itemref')].map((r) => r.getAttribute('idref') ?? '');
    for (const id of spine) if (!byId.has(id)) errors.push(`spine refers to unknown ${id}`);
    const legacy = [...opf.querySelectorAll('metadata > meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content') ?? '';
    const navDoc = parse(dir + (nav[0]?.getAttribute('href') ?? ''));
    const EPUB = 'http://www.idpf.org/2007/ops';
    const toc = [...navDoc.getElementsByTagName('nav')].find((n) => n.getAttributeNS(EPUB, 'type') === 'toc');
    if (!toc) errors.push('nav document has no toc');
    const tocLinks = [...(toc?.getElementsByTagName('a') ?? [])].map((a) => a.getAttribute('href') ?? '');
    const pageItem = byId.get(spine[0] ?? '');
    const pageDoc = parse(dir + (pageItem?.getAttribute('href') ?? ''));
    const img = pageDoc.getElementsByTagName('img')[0];
    let scripts = 0;
    for (const name of Object.keys(docs)) scripts += parse(name).getElementsByTagName('script').length;
    return {
      errors,
      rootfile,
      title: dc('title'),
      language: dc('language'),
      identifier: dc('identifier'),
      modified: [...opf.querySelectorAll('metadata > meta')].find((m) => m.getAttribute('property') === 'dcterms:modified')?.textContent ?? '',
      legacyCover: legacy,
      coverHref: dir + (cover[0]?.getAttribute('href') ?? ''),
      coverType: cover[0]?.getAttribute('media-type') ?? '',
      navHref: dir + (nav[0]?.getAttribute('href') ?? ''),
      spine: spine.map((id) => dir + (byId.get(id)?.getAttribute('href') ?? '')),
      tocLinks: tocLinks.map((h) => dir + h),
      pageImage: dir + (img?.getAttribute('src') ?? ''),
      pageAlt: img?.getAttribute('alt') ?? '',
      scripts,
    };
  }, docs);
}

/** Crop the 2:1 test image to its left edge at the Kindle's 3:4 aspect: red on top, blue below. */
async function cropLeft(page: Page) {
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  const rect = page.getByTestId('crop-rect');
  await expect(rect).toBeVisible();
  await rect.focus();
  for (let i = 0; i < 40; i++) await rect.press('ArrowLeft');
  await page.getByTestId('crop-apply').click();
  await expect(page.locator('.tag', { hasText: 'Cropped' })).toBeVisible();
}

test.describe('EPUB for Kindle Display Cover', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('is offered only for the Kindle cover method', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await expect(page.getByTestId('download-epub')).toHaveCount(0);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    await expect(page.getByTestId('install-method')).toHaveAttribute('data-method', 'kindle-cover');
    await expect(page.getByTestId('download-epub')).toBeVisible();
    await expect(page.getByTestId('download-epub')).toHaveAccessibleDescription(/Send to Kindle/);
    await expect(page.getByTestId('install-method')).toContainText('Send to Kindle');
    await expect(page.getByTestId('install-method')).toContainText('last book you opened');
    await page.getByRole('radio', { name: /KOReader/ }).check({ force: true });
    await expect(page.getByTestId('download-epub')).toHaveCount(0);
  });

  test('crop, download and check the book against the image export', async ({ page }) => {
    const source = quadrants();
    await addFiles(page, [png('quadrants.png', source)]);
    await waitReady(page, 1);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    await page.getByTestId('auto-tone').uncheck();
    await waitPreview(page, '1236 × 1648');
    await cropLeft(page);

    const title = `Сон & 夢の'画面'`;
    const nameInput = page.locator('.file-item').first().locator('.name-input');
    await nameInput.fill(title);
    await nameInput.press('Tab');

    const image = await download(page, 'download-one');
    expect(image.name).toBe(`${title}.png`);
    const epub = await download(page, 'download-epub');
    expect(epub.name).toBe(`${title}.epub`);
    await expect(page.getByTestId('download-message')).toHaveText(`Saved ${title}.epub.`);

    const files = readZip(epub.bytes);
    expect(files[0]!.name).toBe('mimetype');
    expect(files[0]!.data.toString('ascii')).toBe('application/epub+zip');
    expect(epub.bytes.readUInt16LE(8)).toBe(0); // stored
    expect(epub.bytes.readUInt16LE(28)).toBe(0); // no extra field
    expect(files.map((f) => f.name)).toEqual([
      'mimetype',
      'META-INF/container.xml',
      'EPUB/package.opf',
      'EPUB/nav.xhtml',
      'EPUB/cover.xhtml',
      'EPUB/images/cover.png',
    ]);

    const info = await inspectEpub(page, files);
    expect(info.errors).toEqual([]);
    expect(info.title).toBe(title);
    expect(info.language).toBe('en');
    expect(info.identifier).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    expect(info.modified).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(info.legacyCover).toBe('cover-image');
    expect(info.coverHref).toBe('EPUB/images/cover.png');
    expect(info.coverType).toBe('image/png');
    expect(info.spine).toEqual(['EPUB/cover.xhtml']);
    expect(info.tocLinks).toEqual(['EPUB/cover.xhtml']);
    expect(info.pageImage).toBe(info.coverHref);
    expect(info.pageAlt).toBe(title);
    expect(info.scripts).toBe(0);

    // The cover is exactly what the image export produced with the same settings.
    const cover = files.find((f) => f.name === info.coverHref)!.data;
    expect(Buffer.compare(cover, image.bytes)).toBe(0);
    const d = await decodeInPage(page, cover, 'image/png', [
      [100, 400],
      [1100, 400],
      [100, 1300],
      [1100, 1300],
    ]);
    expect([d.width, d.height]).toEqual([1236, 1648]);
    expectGray(d.at(100, 400), luma(RED), 3);
    expectGray(d.at(1100, 400), luma(RED), 3);
    expectGray(d.at(100, 1300), luma(BLUE), 3);
    expectGray(d.at(1100, 1300), luma(BLUE), 3);

    // Nothing from the source file travels along: not its name, not its bytes.
    expect(epub.bytes.includes(Buffer.from('quadrants'))).toBe(false);
    expect(epub.bytes.includes(source.subarray(0, 64))).toBe(false);
  });

  test('a grayscale-only format keeps its gray levels in the PNG cover', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    await page.getByTestId('format').selectOption('bmp2');
    await waitPreview(page, '1236 × 1648');
    const bmp = await download(page, 'download-one');
    expect(bmp.name).toBe('q.bmp');
    const epub = await download(page, 'download-epub');
    const files = readZip(epub.bytes);
    const info = await inspectEpub(page, files);
    expect(info.coverType).toBe('image/png');
    const cover = files.find((f) => f.name === info.coverHref)!.data;
    const points: Array<[number, number]> = [];
    for (let y = 50; y < 1648; y += 160) for (let x = 30; x < 1236; x += 150) points.push([x, y]);
    const a = await decodeInPage(page, bmp.bytes, 'image/bmp', points);
    const b = await decodeInPage(page, cover, 'image/png', points);
    const grays = new Set<number>();
    for (const [x, y] of points) {
      expect(b.at(x, y), `${x},${y}`).toEqual(a.at(x, y));
      grays.add(b.at(x, y)[0]);
    }
    // Only the four native levels of a 2-bit image.
    for (const g of grays) expect([0, 85, 170, 255]).toContain(g);
  });

  test('cancelling does not download', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await hooks(page, { hold: true });
    await page.getByTestId('download-epub').click();
    await expect.poll(() => exportCount(page)).toBe(1);
    await page.getByTestId('download-cancel').click();
    await release(page);
    await expect(page.getByTestId('download-message')).toHaveText('Download cancelled.');
    await page.waitForTimeout(500);
    expect(downloaded).toBe(false);
    await expect(page.getByTestId('download-epub')).toBeEnabled();
  });

  test('a rendering error does not download', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await hooks(page, { fail: true });
    await page.getByTestId('download-epub').click();
    await expect(page.getByTestId('download-message')).toHaveText('Rendering failed.');
    await page.waitForTimeout(300);
    expect(downloaded).toBe(false);
  });

  test('removing the image during export does not download', async ({ page }) => {
    await addFiles(page, [png('q.png', quadrants())]);
    await waitReady(page, 1);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await hooks(page, { hold: true });
    await page.getByTestId('download-epub').click();
    await expect.poll(() => exportCount(page)).toBe(1);
    await page.getByRole('button', { name: 'Remove q.png' }).click();
    await release(page);
    await expect(page.getByTestId('download-message')).toHaveText('Rendering failed.');
    await page.waitForTimeout(300);
    expect(downloaded).toBe(false);
  });

  test('changes made during export do not mix into the book', async ({ page }) => {
    await addFiles(page, [png('first.png', quadrants()), png('second.png', quadrants(200, 400))]);
    await waitReady(page, 2);
    await selectDevice(page, 'pw5', 'kindle-paperwhite-5');
    await page.getByTestId('auto-tone').uncheck();
    await waitPreview(page, '1236 × 1648');
    const expected = await download(page, 'download-one');

    await hooks(page, { hold: true });
    const pending = page.waitForEvent('download');
    await page.getByTestId('download-epub').click();
    await expect.poll(() => exportCount(page)).toBe(2);
    // Switch image, settings and e-reader while the cover is rendering.
    await page.locator('.file-item').nth(1).locator('.thumb').click();
    await page.getByTestId('auto-tone').check();
    await selectDevice(page, 'oasis 3', 'kindle-oasis-3');
    await hooks(page, { hold: false });
    await release(page);

    const epub = await pending;
    expect(epub.suggestedFilename()).toBe('first.epub');
    const files = readZip(await downloadBytes(epub));
    const info = await inspectEpub(page, files);
    expect(info.errors).toEqual([]);
    expect(info.title).toBe('first');
    expect(Buffer.compare(files.find((f) => f.name === info.coverHref)!.data, expected.bytes)).toBe(0);
  });
});
