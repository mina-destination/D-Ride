import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Bookings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load bookings page and display booking data', async ({ page }) => {
    await page.goto('/bookings');


    // Booking should show route name, status, and amount
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible();
    await expect(page.locator('text=130').first()).toBeVisible();
  });

  test('should display passenger and seat info', async ({ page }) => {
    await page.goto('/bookings');


    await expect(page.locator('text=Test Passenger').first()).toBeVisible();
  });
});
