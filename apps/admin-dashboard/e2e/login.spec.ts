import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';

test.describe('Admin Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
  });

  test('should render login page with admin branding', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Admin');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'owner@dride.com');
    await page.fill('#password', 'owner123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/routes');
    await expect(page).toHaveURL('/login');
  });
});
