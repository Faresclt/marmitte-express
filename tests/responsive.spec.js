// Tests responsive mobile (390x844) — pas de scroll horizontal.
import { test, expect } from '@playwright/test';
import { getHorizontalOverflow } from './helpers.js';

const FIRESTORE_TIMEOUT = 15_000;
const TOLERANCE = 5;

async function expectNoHorizontalScroll(page) {
  const { scrollWidth, innerWidth } = await getHorizontalOverflow(page);
  expect(
    scrollWidth,
    `Scroll horizontal détecté: scrollWidth=${scrollWidth} > viewport=${innerWidth}+${TOLERANCE}`,
  ).toBeLessThanOrEqual(innerWidth + TOLERANCE);
}

test.describe('mobile 390x844', () => {
  test('client.html?table=t1 : pas de scroll horizontal', async ({ page }) => {
    await page.goto('client.html?table=t1');
    await expect(page.locator('#app')).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    // Laisser le menu se rendre avant de mesurer.
    await expect(page.locator('.prod-card').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expectNoHorizontalScroll(page);
  });

  test('index.html : pas de scroll horizontal', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('a.app-card').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expectNoHorizontalScroll(page);
  });

  test('serveur.html : pas de scroll horizontal', async ({ page }) => {
    await page.goto('serveur.html');
    await expect(page.locator('#pin-screen, #app').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expectNoHorizontalScroll(page);
  });
});
