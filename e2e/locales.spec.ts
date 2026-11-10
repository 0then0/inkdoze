import { expect, test, type Page } from '@playwright/test';
import { addFiles, quadrants, waitPreview, waitReady } from './helpers.ts';

const LOCALES = ['en', 'ru', 'es', 'de', 'fr', 'ja', 'pt-BR'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'phone', width: 375, height: 812 },
] as const;

/**
 * Collect elements whose text does not fit: content wider than the box, or a box
 * sticking out of its panel, plus page-level horizontal scrolling.
 */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const describe = (el: Element) => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
      return `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${text}"`;
    };
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      problems.push(`page scrolls horizontally: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    const selectors = [
      'button',
      'select',
      'legend',
      'h1',
      'h2',
      'h3',
      'h4',
      '.segmented span',
      '.chip span',
      '.method-tabs span',
      '.badge',
      '.tag',
      '.slider label',
      '.toggle span',
      '.device-name',
      '.device-meta',
      '.facts dd',
      '.field-label',
      '.dims label',
      '.hint',
      '.steps li',
      '.limits li',
      '.offline',
      '.tagline',
    ].join(',');
    for (const el of document.querySelectorAll<HTMLElement>(selectors)) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || el.closest('.sr-only, [hidden]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (style.display !== 'inline' && el.scrollWidth > el.clientWidth + 1) {
        problems.push(`clipped: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      }
      const panel = el.closest('.panel, .topbar, dialog');
      if (panel) {
        const box = panel.getBoundingClientRect();
        if (rect.right > box.right + 1 || rect.left < box.left - 1) problems.push(`outside panel: ${describe(el)}`);
      }
    }
    return problems;
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const locale of LOCALES) {
      test(`${locale}: text fits and nothing overflows`, async ({ page }, info) => {
        await page.addInitScript((l) => {
          localStorage.setItem('inkdoze.locale', l);
          localStorage.setItem('inkdoze.manualSettings', 'open');
        }, locale);
        await page.goto('./');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);

        // Empty state.
        expect(await layoutProblems(page), 'empty state').toEqual([]);

        // With images, a device that has several install methods, and per-file scope.
        await addFiles(page, [
          { name: 'a-very-long-file-name-for-layout-testing.png', mimeType: 'image/png', buffer: quadrants() },
          { name: 'b.png', mimeType: 'image/png', buffer: quadrants(120, 300) },
        ]);
        await waitReady(page, 2);
        await waitPreview(page, '480 × 800');
        await page.locator('input[name="scope"][value="one"]').check({ force: true });
        await page.locator('input[name="target"][value="custom"]').check({ force: true });
        await page.locator('input[name="levels"][value="4"]').check({ force: true });
        await page.locator('[data-device="kindle-paperwhite-6"]').click();
        await page.locator('input[name="target"][value="device"]').check({ force: true });
        expect(await layoutProblems(page), 'working state').toEqual([]);
        await info.attach(`${locale}-${vp.name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

        // Crop dialog.
        await page.locator('.adjust-buttons .button').first().click();
        await expect(page.getByTestId('crop-rect')).toBeVisible();
        expect(await layoutProblems(page), 'crop dialog').toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('crop-rect')).toHaveCount(0);
      });
    }
  });
}

test('language switch updates the interface and is remembered', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('locale').selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Электронная книга' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.reload();
  await expect(page.getByTestId('locale')).toHaveValue('ru');
  await page.getByTestId('locale').selectOption('ja');
  await expect(page.getByRole('heading', { name: '電子書籍リーダー' })).toBeVisible();
});
