import { test, expect } from '@playwright/test';
import { setupDriverMockAPI } from './helpers/mock-api';

test.describe('Driver Portal Login', () => {
  test.beforeEach(async ({ page }) => {
    await setupDriverMockAPI(page);
  });

  test('should render login page with driver branding', async ({ page }) => {
    await page.goto('/login');

    // The login page should have driver-specific elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Driver-specific text
    await expect(page.locator('text=D-Ride').first()).toBeVisible();
  });

  test('should login successfully and redirect to trips', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'driver@dride.com');
    await page.fill('input[type="password"]', 'driver123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/trips');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/trips');
    await expect(page).toHaveURL('/login');
  });

  test('should have language toggle on login page', async ({ page }) => {
    await page.goto('/login');

    const langToggle = page.locator('button:has-text("العربية"), button:has-text("English")');
    await expect(langToggle.first()).toBeVisible();
  });
});
