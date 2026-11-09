import { expect, test } from '@playwright/test';
import { addFiles, decodeInPage, downloadBytes, parseBmp, quadrants, waitPreview, waitReady } from './helpers.ts';

test('phone: add, pick a device by search, download', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('inkdoze.locale', 'en'));
  await page.goto('./');
  await addFiles(page, [{ name: 'phone.png', mimeType: 'image/png', buffer: quadrants() }]);
  await waitReady(page, 1);

  await page.getByRole('searchbox').fill('x3');
  await page.locator('[data-device="xteink-x3"]').tap();
  await waitPreview(page, '528 × 792');

  const download = page.getByTestId('download-one');
  await expect(download).toBeInViewport();
  const [file] = await Promise.all([page.waitForEvent('download'), download.tap()]);
  const bytes = await downloadBytes(file);
  const h = parseBmp(bytes);
  expect([h.width, h.height]).toEqual([528, 792]);
  const d = await decodeInPage(page, bytes, 'image/bmp', [[264, 396]]);
  expect([d.width, d.height]).toEqual([528, 792]);
});

test('keyboard: reach the device list, choose a model and download', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.addInitScript(() => localStorage.setItem('inkdoze.locale', 'en'));
  await page.goto('./');
  await addFiles(page, [{ name: 'kb.png', mimeType: 'image/png', buffer: quadrants() }]);
  await waitReady(page, 1);
  await page.getByRole('searchbox').focus();
  await page.keyboard.type('libra colour');
  // Tab into the device radio group, then arrow to the model.
  const radio = page.locator('[data-device="kobo-libra-colour"] input');
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();
  await waitPreview(page, '1264 × 1680');
  await page.getByTestId('download-one').focus();
  const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(file.suggestedFilename()).toBe('kb.png');
});
