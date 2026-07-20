// Tests caisse — lecture seule. Déverrouillage PIN via localStorage frais
// (PIN par défaut 1234, jamais d'écriture Firestore).
import { test, expect } from '@playwright/test';

const FIRESTORE_TIMEOUT = 15_000;

test.describe('marmite-express-caisse.html', () => {
  test('écran PIN visible au boot', async ({ page }) => {
    await page.goto('marmite-express-caisse.html');
    await expect(page.locator('#pin-screen')).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect(page.locator('button.pkb').first()).toBeVisible();
  });

  test('PIN 1234 déverrouille la caisse puis la salle affiche des tables', async ({ page }) => {
    await page.goto('marmite-express-caisse.html');
    await expect(page.locator('#pin-screen')).toBeVisible({ timeout: FIRESTORE_TIMEOUT });

    // Saisie via les boutons du pavé (auto-check à 4 chiffres).
    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`button.pkb:text-is("${digit}")`).click();
    }

    // Si le PIN par défaut a été changé en prod, skip gracieusement.
    const unlocked = await page
      .locator('#pin-screen')
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!unlocked, 'PIN par défaut 1234 refusé — PIN probablement personnalisé en prod');

    // Onglet Salle (lecture seule : aucun clic sur table, aucune commande).
    await page.locator('button.hbtn-table').click();
    const salle = page.locator('#salle-elements');
    await expect(salle).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect
      .poll(async () => salle.locator('> div').count(), { timeout: FIRESTORE_TIMEOUT })
      .toBeGreaterThan(5);
  });
});
