import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load payments page and display transactions', async ({ page }) => {
    await page.goto('/payments');


    // Transaction data should be visible
    await expect(page.locator('text=SUCCESS').first()).toBeVisible();
    await expect(page.locator('text=130').first()).toBeVisible();
  });

  test('should display payment method', async ({ page }) => {
    await page.goto('/payments');


    await expect(page.locator('text=CARD').first()).toBeVisible();
  });
});
