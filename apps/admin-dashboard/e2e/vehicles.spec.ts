import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Vehicles Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load vehicles page and display vehicles', async ({ page }) => {
    await page.goto('/vehicles');


    await expect(page.locator('text=Toyota').first()).toBeVisible();
    await expect(page.locator('text=HiAce').first()).toBeVisible();
    await expect(page.locator('text=DR-20').first()).toBeVisible();
  });

  test('should show vehicle capacity and status', async ({ page }) => {
    await page.goto('/vehicles');


    await expect(page.locator('text=14 seats').first()).toBeVisible(); // Capacity
    await expect(page.locator('text=ACTIVE').first()).toBeVisible(); // Status
  });

  test('should have add vehicle button', async ({ page }) => {
    await page.goto('/vehicles');


    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Register")').first();
    await expect(addBtn).toBeVisible();
  });
});
