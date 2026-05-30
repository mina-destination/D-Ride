import { test, expect } from '@playwright/test';
import { setupDriverMockAPI } from './helpers/mock-api';
import { loginAsDriver } from './helpers/auth';

test.describe('Driver Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupDriverMockAPI(page);
    await loginAsDriver(page);
  });

  test('should load profile page with driver info', async ({ page }) => {
    await page.goto('/profile');


    await expect(page.locator('text=Captain Ahmed').first()).toBeVisible();
    await expect(page.locator('text=driver@dride.com').first()).toBeVisible();
  });

  test('should display driver phone number', async ({ page }) => {
    await page.goto('/profile');


    await expect(page.locator('text=01011112222').first()).toBeVisible();
  });

  test('should display DRIVER role badge', async ({ page }) => {
    await page.goto('/profile');


    await expect(page.locator('text=DRIVER').first()).toBeVisible();
  });

  test('should have sign out button', async ({ page }) => {
    await page.goto('/profile');


    const signOutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("تسجيل الخروج")').first();
    await expect(signOutBtn).toBeVisible();
  });
});
