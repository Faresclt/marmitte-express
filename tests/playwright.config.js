// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://faresclt.github.io/marmitte-express/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      testIgnore: /responsive\.spec\.js/,
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        browserName: 'chromium',
      },
      testMatch: /responsive\.spec\.js/,
    },
  ],
});
