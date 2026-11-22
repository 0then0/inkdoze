import { expect, test, type Page } from '@playwright/test';
import { PROFILES_KEY } from '../src/ui/profiles.ts';
import { addFiles, BLUE, decodeInPage, downloadBytes, parseBmp, quadrants, readZip, RED, saveProfile, selectDevice, setCustomSize, waitPreview, waitReady } from './helpers.ts';

const profiles = (page: Page) => page.getByRole('region', { name: 'Processing profiles' });
const profileList = (page: Page) => profiles(page).getByRole('combobox');
const action = (page: Page, name: string) => profiles(page).getByRole('button', { name, exact: true });
const empty = 'No profiles for this model and output mode.';
const png = (name: string) => ({ name, mimeType: 'image/png', buffer: quadrants() });

function previewPixels(page: Page, points: Array<[number, number]>) {
  return page.getByTestId('preview-canvas').evaluate((canvas: HTMLCanvasElement, samples) => {
    const ctx = canvas.getContext('2d')!;
    return samples.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
  }, points);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('inkdoze.locale', 'en');
    localStorage.setItem('inkdoze.manualSettings', 'open');
  });
  await page.goto('./');
});

test('applying a profile in per-image scope keeps the crop, file name and overrides in preview and ZIP', async ({ page }) => {
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

  await all.check({ force: true });
  await expect(format).toHaveValue('png');
  await format.selectOption('jpeg');
  await autoTone.check();
  await page.locator('input[name="target"][value="device"]').check({ force: true });
  await one.check({ force: true });
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
  await page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('profiles', 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.objectStore('profiles').put('{malformed', 'current');
      });
    } finally {
      db.close();
    }
  }, PROFILES_KEY);
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
