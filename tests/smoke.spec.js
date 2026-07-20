// Smoke tests lecture seule contre le site prod.
// AUCUNE écriture Firestore : pas d'envoi de commande, pas de publication.
import { test, expect } from '@playwright/test';
import { collectConsoleErrors } from './helpers.js';

const FIRESTORE_TIMEOUT = 15_000;

test.describe('index.html', () => {
  test('accueil charge avec les 4 cartes app et sans erreur console grave', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('index.html');

    await expect(page).toHaveTitle(/Marmite/i);

    await expect(page.locator('a.app-card.caisse')).toBeVisible();
    await expect(page.locator('a.app-card.serveur')).toBeVisible();
    await expect(page.locator('a.app-card.client')).toBeVisible();
    await expect(page.locator('a.app-card.qrcode')).toBeVisible();

    expect(errors, `Erreurs console graves: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('client.html', () => {
  test('menu charge avec catégories, produits et pill table t1', async ({ page }) => {
    await page.goto('client.html?table=t1');

    await expect(page.locator('#app')).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect(page.locator('#menu-tabs .mtab').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect(page.locator('.prod-card').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });

    const pill = page.locator('.table-pill');
    await expect(pill).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect(pill).toContainText(/t1/i);
  });

  test('clic sur un produit ouvre la modale détail avec nom + prix, et se ferme', async ({ page }) => {
    await page.goto('client.html?table=t1');

    const firstCard = page.locator('.prod-card').first();
    await expect(firstCard).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await firstCard.click();

    const modal = page.locator('#detail-modal');
    await expect(modal).toHaveClass(/show/, { timeout: FIRESTORE_TIMEOUT });

    await expect(page.locator('#detail-name')).not.toBeEmpty();
    await expect(page.locator('#detail-price')).toContainText('€');

    await page.locator('#detail-close').click();
    await expect(modal).not.toHaveClass(/show/);
  });
});

test.describe('serveur.html', () => {
  test('page charge : PIN, sélecteur de table ou app visible', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('serveur.html');

    // Selon serveurPin configuré côté Firestore : PIN screen, sinon le
    // sélecteur de table (#table-picker, écran par défaut au boot), sinon
    // l'app directe si une table est déjà mémorisée.
    await expect(page.locator('#pin-screen, #table-picker, #app').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    const pinVisible = await page.locator('#pin-screen').isVisible().catch(() => false);
    const pickerVisible = await page.locator('#table-picker').isVisible().catch(() => false);
    const appVisible = await page.locator('#app').isVisible().catch(() => false);
    expect(pinVisible || pickerVisible || appVisible, 'Ni PIN, ni table-picker, ni app visible sur serveur.html').toBe(true);

    // Le plan doit contenir des tables cliquables une fois Firestore chargé
    if (pickerVisible) {
      await expect(page.locator('#plan-inner > *').first()).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    }

    expect(errors, `Erreurs console graves: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('cuisine.html', () => {
  test('page charge avec le badge EN DIRECT et sans erreur console grave', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('cuisine.html');

    await expect(page.locator('.hdr-live')).toBeVisible({ timeout: FIRESTORE_TIMEOUT });
    await expect(page.locator('.hdr-live')).toContainText(/EN DIRECT/i);

    expect(errors, `Erreurs console graves: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('qrcodes.html', () => {
  test('au moins un QR code généré après chargement Firestore', async ({ page }) => {
    await page.goto('qrcodes.html');

    // qrcodejs génère un canvas caché + un img visible : on cible l'img.
    await expect(page.locator('#qr-grid img').first())
      .toBeVisible({ timeout: FIRESTORE_TIMEOUT });
  });
});
