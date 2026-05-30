import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Drivers Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load drivers page and display driver list', async ({ page }) => {
    await page.goto('/drivers');


    await expect(page.locator('text=Captain Ahmed').first()).toBeVisible();
    await expect(page.locator('text=driver@dride.com').first()).toBeVisible();
  });

  test('should display driver phone number', async ({ page }) => {
    await page.goto('/drivers');


    await expect(page.locator('text=01011112222').first()).toBeVisible();
  });

  test('should have create driver button', async ({ page }) => {
    await page.goto('/drivers');


    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    await expect(addBtn).toBeVisible();
  });
});
