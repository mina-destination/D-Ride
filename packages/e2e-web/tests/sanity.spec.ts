import { test, expect } from '@playwright/test';

test.describe('Sanity Check', () => {
  test('should render login page with admin branding', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Admin');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });
});
