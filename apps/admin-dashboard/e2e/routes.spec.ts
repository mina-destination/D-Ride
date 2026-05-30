import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Routes Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load routes page and display routes table', async ({ page }) => {
    await page.goto('/routes');


    // Routes page should be visible
    await expect(page.locator('text=Maadi to Smart Village').first()).toBeVisible();
  });

  test('should display route details including checkpoints', async ({ page }) => {
    await page.goto('/routes');


    // Check checkpoint names are visible somewhere on the page
    await expect(page.locator('text=Maadi Square').first()).toBeVisible();
  });

  test('should have create route action button', async ({ page }) => {
    await page.goto('/routes');


    // Look for a create/add button
    const createBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    await expect(createBtn).toBeVisible();
  });
});
