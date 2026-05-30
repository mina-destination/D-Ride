import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');


    // Settings page should render (not redirect to login)
    const url = page.url();
    expect(url).toContain('/settings');
  });

  test('should display settings sections', async ({ page }) => {
    await page.goto('/settings');


    // Check that some settings content is visible
    const content = page.locator('.ant-card, .glass, .settings, [class*="setting"]').first();
    await expect(content).toBeVisible();
  });
});
