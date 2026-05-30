import { test, expect } from '@playwright/test';
import { setupDriverMockAPI } from './helpers/mock-api';
import { loginAsDriver } from './helpers/auth';

test.describe('Driver My Trips Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupDriverMockAPI(page);
    await loginAsDriver(page);
  });

  test('should load trips page and display assigned trips', async ({ page }) => {
    await page.goto('/trips');


    // Route name should be visible
    await expect(page.locator('text=Maadi to Smart Village').first()).toBeVisible();
  });

  test('should show trip status on cards', async ({ page }) => {
    await page.goto('/trips');


    await expect(page.locator('text=SCHEDULED').first()).toBeVisible();
  });

  test('should have active and past tabs', async ({ page }) => {
    await page.goto('/trips');


    // Check for tab-like elements
    const activeTab = page.locator('button:has-text("Active"), [class*="tab"]:has-text("Active")').first();
    const pastTab = page.locator('button:has-text("Past"), button:has-text("Completed"), [class*="tab"]:has-text("Past")').first();

    await expect(activeTab).toBeVisible();
    await expect(pastTab).toBeVisible();
  });

  test('should navigate to trip detail when clicking a trip card', async ({ page }) => {
    await page.goto('/trips');


    // Click the first trip card or its action button
    const tripAction = page.locator('a:has-text("View"), button:has-text("View"), [class*="trip-card"]').first();
    await tripAction.click();

    // Should navigate to trip detail
    await expect(page).toHaveURL(new RegExp('\\/trips\\/'));
  });

  test('should display driver name in header', async ({ page }) => {
    await page.goto('/trips');


    await expect(page.locator('text=Captain Ahmed').first()).toBeVisible();
  });
});
