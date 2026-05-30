import { test, expect } from '@playwright/test';
import { setupDriverMockAPI, MOCK_TRIPS } from './helpers/mock-api';
import { loginAsDriver } from './helpers/auth';

test.describe('Driver Trip Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupDriverMockAPI(page);
    await loginAsDriver(page);
  });

  test('should load trip detail page with trip info', async ({ page }) => {
    await page.goto(`/trips/${MOCK_TRIPS[0]._id}`);


    // Trip route name
    await expect(page.locator('text=Maadi to Smart Village').first()).toBeVisible();
  });

  test('should display passenger manifest', async ({ page }) => {
    await page.goto(`/trips/${MOCK_TRIPS[0]._id}`);


    // Passenger names from bookings should appear
    await expect(page.locator('text=Test Passenger').first()).toBeVisible();
  });

  test('should display trip status and timing', async ({ page }) => {
    await page.goto(`/trips/${MOCK_TRIPS[0]._id}`);


    await expect(page.locator('text=SCHEDULED').first()).toBeVisible();
  });

  test('should have action buttons for trip progression', async ({ page }) => {
    await page.goto(`/trips/${MOCK_TRIPS[0]._id}`);


    // Look for status progression or live drive buttons
    const actionBtn = page.locator('button:has-text("Start"), button:has-text("Board"), button:has-text("Live Drive"), button:has-text("Begin")').first();
    await expect(actionBtn).toBeVisible();
  });
});
