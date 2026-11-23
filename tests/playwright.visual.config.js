// Audit visuel multi-appareils sur ÉMULATEURS Firebase (voir visual-audit.spec.js).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /visual-audit\.spec\.js/,
  timeout: 600_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8097/',
    bypassCSP: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'python -m http.server 8097',
    cwd: '..',
    url: 'http://localhost:8097/index.html',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
