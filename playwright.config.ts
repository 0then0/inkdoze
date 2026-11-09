import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Serve the production build under a sub-path, the way GitHub Pages hosts project sites.
const BASE_PATH = '/inkdoze/';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --base ${BASE_PATH}`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
