import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Trips Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load trips page and display trips list', async ({ page }) => {
    await page.goto('/trips');


    // Trips data should be rendered
    await expect(page.locator('text=Maadi to Smart Village').first()).toBeVisible();
    await expect(page.locator('text=SCHEDULED').first()).toBeVisible();
  });

  test('should display trip details: price, seats, driver', async ({ page }) => {
    await page.goto('/trips');


    await expect(page.locator('text=65').first()).toBeVisible(); // Price
    await expect(page.locator('text=Captain Ahmed').first()).toBeVisible(); // Driver
  });

  test('should have schedule new trip button', async ({ page }) => {
    await page.goto('/trips');


    const scheduleBtn = page.locator('button:has-text("Schedule"), button:has-text("Add"), button:has-text("New Trip")').first();
    await expect(scheduleBtn).toBeVisible();
  });

  test('should open schedule trip modal when clicking add button', async ({ page }) => {
    await page.goto('/trips');


    const scheduleBtn = page.locator('button:has-text("Schedule"), button:has-text("Add"), button:has-text("New Trip")').first();
    await scheduleBtn.click();

    // Modal should appear with form elements
    const modal = page.locator('.ant-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });
});
