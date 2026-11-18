// Tests bout-en-bout sur ÉMULATEURS Firebase (aucune donnée de prod touchée).
// Lancer depuis la racine du repo :
//   firebase emulators:exec --only firestore,auth --project la-marmitte-express "npx --prefix tests playwright test -c tests/playwright.emu.config.js"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /emu-.*\.spec\.js/,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8097/',
    bypassCSP: true,            // CSP des pages : n'autorise pas 127.0.0.1 (émulateur)
    serviceWorkers: 'block',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'python -m http.server 8097',
    cwd: '..',
    url: 'http://localhost:8097/index.html',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
