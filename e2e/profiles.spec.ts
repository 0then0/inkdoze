import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS } from '../src/pipeline/types.ts';
import { MAX_PROFILES, PROFILES_KEY } from '../src/ui/profiles.ts';
import { addFiles, BLUE, bmpPixel, chooseProfileFile, decodeInPage, downloadBytes, exportProfileFile, openProfileFile, parseBmp, quadrants, readZip, RED, saveProfile, selectDevice, setCustomSize, waitPreview, waitReady } from './helpers.ts';

const profiles = (page: Page) => page.getByRole('region', { name: 'Processing profiles' });
const profileList = (page: Page) => profiles(page).getByRole('combobox');
const action = (page: Page, name: string) => profiles(page).getByRole('button', { name, exact: true });
const empty = 'No profiles for this model and output mode.';
const png = (name: string) => ({ name, mimeType: 'image/png', buffer: quadrants() });
const portableProfile = {
  name: 'Portable', deviceId: 'xteink-x4', outputMode: 'standard', settings: DEFAULT_SETTINGS,
};

function profileFile(patch: object = {}) {
  const json = { format: 'inkdoze.processing-profile', version: 1, ...portableProfile, ...patch };
  return { name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) };
}

async function open(page: Page, url = './') {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
  });
  await page.goto(url);
}

async function profileRecord(page: Page, replacement?: unknown) {
  return page.evaluate(async ({ key, replacement }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction('profiles', replacement === undefined ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('profiles');
        const request = replacement === undefined ? store.get('current') : store.put(replacement, 'current');
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }, { key: PROFILES_KEY, replacement });
}

function previewPixels(page: Page, points: Array<[number, number]>) {
  return page.getByTestId('preview-canvas').evaluate((canvas: HTMLCanvasElement, samples) => {
    const ctx = canvas.getContext('2d')!;
    return samples.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
  }, points);
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('applying an imported profile in per-image scope keeps the crop, file name and overrides in preview and ZIP', async ({ page }) => {
  const format = page.getByTestId('format');
  const autoTone = page.getByTestId('auto-tone');
  const one = page.locator('input[name="scope"][value="one"]');
  const all = page.locator('input[name="scope"][value="all"]');
  await addFiles(page, [png('detail.png'), png('plain.png')]);
  await waitReady(page, 2);
  await setCustomSize(page, 100, 100);
  await page.getByRole('radio', { name: 'Stretch', exact: true }).check({ force: true });
  await autoTone.uncheck();
  await format.selectOption('png');

  await one.check({ force: true });
  await format.selectOption('bmp24');
  await page.locator('input[name="color-mode"][value="color"]').check({ force: true });
  await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  const rect = page.getByTestId('crop-rect');
  for (let i = 0; i < 30; i++) await rect.press('ArrowLeft');
  await page.getByTestId('crop-apply').click();
  const fileName = page.getByRole('textbox', { name: 'File name for detail.png' });
  await fileName.fill('personal');
  await fileName.blur();
  await saveProfile(page, 'Square grayscale');
  const json = await downloadBytes(await exportProfileFile(page));

  await all.check({ force: true });
  await expect(format).toHaveValue('png');
  await format.selectOption('jpeg');
  await autoTone.check();
  await page.locator('input[name="target"][value="device"]').check({ force: true });
  await one.check({ force: true });
  await waitPreview(page, '480 × 800');
  const dialog = await openProfileFile(page, { name: 'square.json', mimeType: 'application/json', buffer: json });
  await expect(dialog.getByRole('alert')).toContainText('A profile named “Square grayscale” already exists');
  await expect(dialog.getByRole('textbox', { name: 'Save as' })).toHaveValue('Square grayscale (2)');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Square grayscale', 'Square grayscale (2)']);
  await profileList(page).selectOption({ label: 'Square grayscale (2)' });
  await waitPreview(page, '480 × 800');
  await action(page, 'Apply profile').click();
  await expect(action(page, 'Apply profile')).toHaveAccessibleDescription('Profiles set the batch defaults. Per-image settings take priority.');
  await expect(one).toBeChecked();
  await expect(format).toHaveValue('bmp24');
  await expect(page.locator('.file-item.selected')).toContainText('Cropped');
  await expect(fileName).toHaveValue('personal');
  await waitPreview(page, '100 × 100');

  const points: Array<[number, number]> = [[10, 20], [90, 20], [10, 80], [90, 80]];
  const cropped = [RED, RED, BLUE, BLUE];
  await expect.poll(() => previewPixels(page, points)).toEqual(cropped);
  await page.getByRole('button', { name: 'Select plain.png', exact: true }).click();
  const grayscale = [76, 149, 28, 226].map((v) => [v, v, v, 255]);
  await expect.poll(() => previewPixels(page, points)).toEqual(grayscale);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
  const files = readZip(await downloadBytes(download));
  expect(files.map(({ name }) => name)).toEqual(['personal.bmp', 'plain.png']);
  const bmp = files[0]!.data;
  expect(parseBmp(bmp)).toMatchObject({ width: 100, height: 100, bpp: 24 });
  const pngBytes = files[1]!.data;
  expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const detail = await decodeInPage(page, bmp, 'image/bmp', points);
  const plain = await decodeInPage(page, pngBytes, 'image/png', points);
  expect([plain.width, plain.height]).toEqual([100, 100]);
  expect(points.map(([x, y]) => detail.at(x, y))).toEqual(cropped);
  expect(points.map(([x, y]) => plain.at(x, y))).toEqual(grayscale);
});

test('filters profiles by model and mode and persists rename and deletion', async ({ page }) => {
  await page.getByTestId('format').selectOption('jpeg');
  await saveProfile(page, 'Daily');

  await selectDevice(page, 'x3', 'xteink-x3');
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await saveProfile(page, 'Daily');
  await saveProfile(page, 'X3 only');
  await selectDevice(page, 'x4', 'xteink-x4');
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Daily']);
  await expect(action(page, 'Apply profile')).toBeDisabled();

  const mode = page.getByTestId('output-mode');
  await mode.selectOption('crosspoint-overlay');
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await saveProfile(page, 'Overlay');
  await mode.selectOption('standard');
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Daily']);
  await expect(page.getByTestId('format')).toHaveValue('jpeg');
  await profileList(page).selectOption({ label: 'Daily' });
  await action(page, 'Rename').click();
  const input = page.getByRole('textbox', { name: 'Profile name' });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Daily');
  await input.fill('X4 photo');
  await input.press('Enter');
  await expect(profiles(page).getByRole('status')).toHaveText('Profile renamed.');

  await page.reload();
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'X4 photo']);
  await profileList(page).selectOption({ label: 'X4 photo' });
  await expect(page.getByTestId('format')).toHaveValue('auto');
  await action(page, 'Delete').click();
  await expect(profiles(page).getByRole('status')).toHaveText('Profile deleted.');
  await page.reload();
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await mode.selectOption('crosspoint-overlay');
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Overlay']);
  await mode.selectOption('standard');
  await selectDevice(page, 'x3', 'xteink-x3');
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Daily', 'X3 only']);
});

test('recovers from damaged profile data and keeps conversion available after a rejected save', async ({ page }) => {
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await profileRecord(page, '{malformed');
  await page.reload();
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await saveProfile(page, 'Recovered');

  await page.evaluate((key) => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, id?: IDBValidKey) {
      const request = put.call(this, value, id);
      if (this.transaction.db.name === key) this.transaction.abort();
      return request;
    };
  }, PROFILES_KEY);
  await action(page, 'Save batch settings as a profile').click();
  const input = page.getByRole('textbox', { name: 'Profile name' });
  await input.fill('Retry later');
  await input.press('Enter');
  await expect(profiles(page).getByRole('alert')).toContainText('Could not save changes to profiles.');
  await expect(input).toHaveValue('Retry later');
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Recovered']);

  await input.fill('Switch modes while saving');
  await expect(profiles(page).getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('#profile-name')!.form!.requestSubmit();
    const mode = document.querySelector<HTMLSelectElement>('#output-mode')!;
    mode.value = 'crosspoint-overlay';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('output-mode')).toHaveValue('crosspoint-overlay');
  await expect(profiles(page).getByRole('alert')).toContainText('Could not save changes to profiles.');
  await page.getByTestId('output-mode').selectOption('standard');

  await addFiles(page, [png('ordinary.png')]);
  await waitReady(page, 1);
  await waitPreview(page, '480 × 800');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-one').click()]);
  expect(download.suggestedFilename()).toBe('ordinary.bmp');
  expect(parseBmp(await downloadBytes(download))).toMatchObject({ width: 480, height: 800, bpp: 24 });
  await page.reload();
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Recovered']);
});

test('exports the saved settings and reproduces the image in a clean browser context', async ({ page, browser }, info) => {
  const name = 'Ночной профиль';
  const photo = png('sample.png');
  await addFiles(page, [photo]);
  await waitReady(page, 1);
  await setCustomSize(page, 96, 128);
  await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByTestId('auto-tone').uncheck();
  await page.locator('input[name="color-mode"][value="grayscale"]').check({ force: true });
  await page.locator('#tone-brightness').fill('-14');
  await page.locator('#tone-contrast').fill('25');
  await page.getByLabel('Invert', { exact: true }).check();
  await page.locator('input[name="levels"][value="4"]').check({ force: true });
  await page.locator('input[name="dither"][value="atkinson"]').check({ force: true });
  const format = page.getByTestId('format');
  await format.selectOption('jpeg');
  await page.locator('#jpeg-quality').fill('0.73');
  await format.selectOption('bmp2');
  await saveProfile(page, name);

  const points: Array<[number, number]> = [[8, 8], [24, 45], [70, 45], [24, 83], [70, 83], [88, 120]];
  async function downloadSample(tab: Page) {
    await waitPreview(tab, '96 × 128');
    const [download] = await Promise.all([tab.waitForEvent('download'), tab.getByTestId('download-one').click()]);
    expect(download.suggestedFilename()).toBe('sample.bmp');
    const bytes = await downloadBytes(download);
    const header = parseBmp(bytes);
    expect(header).toMatchObject({ width: 96, height: 128, bpp: 2, compression: 0, palette: [0, 85, 170, 255] });
    return points.map(([x, y]) => bmpPixel(bytes, header, x, y));
  }

  const original = await downloadSample(page);
  expect(new Set(original).size).toBeGreaterThan(1);
  const originalId = await profileList(page).inputValue();
  await format.selectOption('png');
  await page.locator('input[name="target"][value="device"]').check({ force: true });
  const exported = await exportProfileFile(page);
  expect(exported.suggestedFilename()).toBe(`inkdoze-profile-${name}.json`);
  expect(JSON.parse((await downloadBytes(exported)).toString('utf8'))).toEqual({
    format: 'inkdoze.processing-profile', version: 1, name, deviceId: 'xteink-x4', outputMode: 'standard',
    settings: {
      target: 'custom', customWidth: 96, customHeight: 128, fit: 'fit', background: '#000000', colorMode: 'grayscale',
      autoTone: false, brightness: -14, contrast: 25, invert: true, levels: 4, dither: 'atkinson', format: 'bmp2', jpegQuality: 0.73,
    },
  });
  const path = info.outputPath('portable.json');
  await exported.saveAs(path);

  const clean = await browser.newContext({ acceptDownloads: true });
  try {
    const receiving = await clean.newPage();
    await open(receiving, page.url());
    await expect(profiles(receiving).getByText(empty)).toBeVisible();
    await expect(action(receiving, 'Export profile')).toBeDisabled();
    await addFiles(receiving, [photo]);
    await waitReady(receiving, 1);
    const dialog = await openProfileFile(receiving, path);
    await expect(dialog.locator('dd')).toHaveText([
      name, /^Xteink X4 · /, 'Standard sleep screen', 'Custom', '96 × 128 px', 'Fit', '#000000', 'Grayscale',
      'Off', '-14', '25', 'On', '4', 'Atkinson', 'BMP 2-bit, 4 grays', '73%',
    ]);
    expect(await profileRecord(receiving)).toBeUndefined();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(action(receiving, 'Import profile')).toBeFocused();
    await expect(profiles(receiving).getByRole('status')).toContainText('Profile imported.');
    await profileList(receiving).selectOption({ label: name });
    expect(await profileList(receiving).inputValue()).not.toBe(originalId);
    await waitPreview(receiving, '480 × 800');
    await expect(receiving.getByTestId('format')).toHaveValue('auto');
    await action(receiving, 'Apply profile').click();
    expect(await downloadSample(receiving)).toEqual(original);
  } finally {
    await clean.close();
  }
});

test('imports Custom size and CrossPoint profiles into their own model and mode', async ({ page, browser }) => {
  await page.locator('.custom-option').click();
  await setCustomSize(page, 83, 121);
  await saveProfile(page, 'Daily');
  const custom = await downloadBytes(await exportProfileFile(page));
  expect(JSON.parse(custom.toString('utf8'))).toMatchObject({ deviceId: null, outputMode: 'standard', settings: { customWidth: 83, customHeight: 121 } });

  await selectDevice(page, 'x4', 'xteink-x4');
  await page.getByTestId('output-mode').selectOption('crosspoint-overlay');
  await page.getByRole('radio', { name: 'Fit', exact: true }).check({ force: true });
  await saveProfile(page, 'Daily');
  const overlay = await downloadBytes(await exportProfileFile(page));
  expect(JSON.parse(overlay.toString('utf8'))).toEqual({
    format: 'inkdoze.processing-profile', version: 1, name: 'Daily', deviceId: 'xteink-x4', outputMode: 'crosspoint-overlay', settings: { fit: 'fit' },
  });

  const clean = await browser.newContext();
  try {
    const receiving = await clean.newPage();
    await open(receiving, page.url());
    const mode = receiving.getByTestId('output-mode');
    const customDialog = await openProfileFile(receiving, { name: 'custom.json', mimeType: 'application/json', buffer: custom });
    await expect(customDialog.locator('dd').nth(1)).toHaveText('Custom size');
    await customDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(profiles(receiving).getByText(empty)).toBeVisible();
    const overlayDialog = await openProfileFile(receiving, { name: 'overlay.json', mimeType: 'application/json', buffer: overlay });
    await expect(overlayDialog.locator('dd')).toHaveText(['Daily', /^Xteink X4 · /, 'CrossPoint sleep overlay', 'Fit']);
    await overlayDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(mode).toHaveValue('standard');
    await expect(profiles(receiving).getByText(empty)).toBeVisible();
    await mode.selectOption('crosspoint-overlay');
    await profileList(receiving).selectOption({ label: 'Daily' });
    await expect(receiving.getByRole('radio', { name: 'Fill', exact: true })).toBeChecked();
    await action(receiving, 'Apply profile').click();
    await expect(receiving.getByRole('radio', { name: 'Fit', exact: true })).toBeChecked();

    await receiving.locator('.custom-option').click();
    await profileList(receiving).selectOption({ label: 'Daily' });
    await action(receiving, 'Apply profile').click();
    await expect(receiving.getByTestId('custom-width')).toHaveValue('83');
    await expect(receiving.getByTestId('custom-height')).toHaveValue('121');
  } finally {
    await clean.close();
  }
});

test('keeps the import open after the file picker is canceled or a file is rejected', async ({ page }) => {
  await page.evaluate(() => {
    const arrayBuffer = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      if (this.name === 'unreadable.json') return Promise.reject(new DOMException('File moved', 'NotReadableError'));
      return arrayBuffer.call(this);
    };
  });
  await action(page, 'Import profile').press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Import profile' });
  await dialog.locator('input[type="file"]').dispatchEvent('cancel', { bubbles: true });
  await expect(dialog).toBeVisible();
  const examples = [
    [profileFile({ version: 2 }), 'This profile file version is unsupported.'],
    [profileFile({ deviceId: 'obsolete-model' }), 'The e-reader model in the file is unknown.'],
    [profileFile({ outputMode: 'future-mode' }), 'The output mode in the file is unsupported for this model.'],
    [profileFile({ settings: { ...DEFAULT_SETTINGS, brightness: 101 } }), 'The file contains invalid processing settings.'],
    [{ ...profileFile(), buffer: Buffer.alloc(16 * 1024 + 1) }, 'The profile file exceeds 16 KiB.'],
    [{ ...profileFile(), buffer: Buffer.from('{broken') }, 'The profile file is not valid UTF-8 JSON.'],
    [{ ...profileFile(), name: 'unreadable.json' }, 'Could not read the profile file.'],
  ] as const;
  let button = 'Choose JSON file';
  for (const [file, error] of examples) {
    await chooseProfileFile(page, file, button);
    await expect(dialog.getByRole('alert')).toHaveText(error);
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    button = 'Choose another file';
    await expect(dialog.getByRole('button', { name: button, exact: true })).toBeFocused();
  }
  await chooseProfileFile(page, profileFile(), button);
  await expect(dialog.getByText('Portable', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(action(page, 'Import profile')).toBeFocused();
  expect(await profileRecord(page)).toBeUndefined();
});

test('rechecks names when another tab saves after import confirmation', async ({ page, context }) => {
  const other = await context.newPage();
  await open(other, page.url());
  await expect(profiles(other).getByText(empty)).toBeVisible();
  const name = 'Shared night';
  const dialog = await openProfileFile(page, profileFile({ name }));
  await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);

  // Pause the import after the user confirms and before its readwrite transaction starts.
  await page.evaluate((key) => {
    const openDatabase = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      const request = openDatabase.call(this, name, version);
      if (name === key) {
        IDBFactory.prototype.open = openDatabase;
        Object.defineProperty(request, 'onsuccess', {
          set(handler: IDBOpenDBRequest['onsuccess']) {
            request.addEventListener('success', (event) => {
              document.addEventListener('release-profile-save', () => handler?.call(request, event), { once: true });
              document.documentElement.dataset.profileSaveHeld = 'true';
            }, { once: true });
          },
        });
      }
      return request;
    };
  }, PROFILES_KEY);
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  await expect(page.locator('html')).toHaveAttribute('data-profile-save-held', 'true');
  await expect(save).toBeDisabled();
  await other.getByTestId('format').selectOption('png');
  await saveProfile(other, 'shared NIGHT');
  const beforeImport = await profileRecord(other);
  await page.evaluate(() => document.dispatchEvent(new Event('release-profile-save')));

  await expect(dialog.getByRole('alert')).toContainText('A profile named “Shared night” already exists');
  const alternate = dialog.getByRole('textbox', { name: 'Save as' });
  await expect(alternate).toHaveValue('Shared night (2)');
  await expect(alternate).toBeFocused();
  expect(await profileRecord(other)).toEqual(beforeImport);
  await alternate.fill('A second profile');
  await alternate.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(profileList(other).locator('option')).toHaveText(['Choose a profile', 'shared NIGHT', 'A second profile']);
  expect(await profileRecord(other)).toMatchObject({ profiles: [
    { name: 'shared NIGHT', settings: { format: 'png' } }, { name: 'A second profile', settings: { format: 'auto' } },
  ] });
});

test('checks the collection limit and preserves records from a newer build', async ({ page }) => {
  await expect(profiles(page).getByText(empty)).toBeVisible();
  const full = { version: 1, profiles: Array.from({ length: MAX_PROFILES }, (_, i) => ({
    ...portableProfile, id: `id-${i}`, name: `Profile ${i}`,
  })) };
  await profileRecord(page, full);
  const dialog = await openProfileFile(page, profileFile());
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText(`You can save up to ${MAX_PROFILES} profiles.`);
  expect(await profileRecord(page)).toEqual(full);
  await page.keyboard.press('Escape');

  const newer = { version: 2, profiles: [{ futureProfileData: true }] };
  await profileRecord(page, newer);
  await page.reload();
  await expect(profiles(page).getByRole('alert')).toHaveText('Open a newer build of InkDoze to use your saved profiles.');
  await openProfileFile(page, profileFile());
  await save.click();
  await expect(dialog.getByRole('alert')).toHaveText('Open a newer build of InkDoze to use your saved profiles.');
  await expect(save).toBeEnabled();
  expect(await profileRecord(page)).toEqual(newer);
});

test('shows IndexedDB read and write failures and keeps the import ready to retry', async ({ page }) => {
  await expect(profiles(page).getByText(empty)).toBeVisible();
  await page.evaluate((key) => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (id) {
      if (this.transaction.db.name === key) {
        IDBObjectStore.prototype.get = get;
        throw new DOMException('Read failed', 'SecurityError');
      }
      return get.call(this, id);
    };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, id?: IDBValidKey) {
      const request = put.call(this, value, id);
      if (this.transaction.db.name === key) {
        IDBObjectStore.prototype.put = put;
        this.transaction.abort();
      }
      return request;
    };
  }, PROFILES_KEY);

  const dialog = await openProfileFile(page, profileFile());
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('Could not read saved profiles.');
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save changes to profiles.');
  await expect(dialog.getByText('Portable', { exact: true })).toBeVisible();
  expect(await profileRecord(page)).toBeUndefined();
  await save.click();
  await expect(dialog).toBeHidden();
  await expect(profileList(page).locator('option')).toHaveText(['Choose a profile', 'Portable']);
});
