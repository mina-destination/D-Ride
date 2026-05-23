import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Contact Support Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should load contact page and display contact details and user info', async ({ page }) => {
    await page.goto('/contact');

    // Page titles
    await expect(page.locator('h1')).toContainText('Get in Touch');
    await expect(page.locator('text=Support & Help Desk')).toBeVisible();

    // Check support cards are loaded
    await expect(page.locator('text=support@dride.com')).toBeVisible();
    await expect(page.locator('text=+20 100 123 4567')).toBeVisible();

    // Check user info is auto-populated in readonly panel
    await expect(page.locator('.auth-card >> text=Test Passenger')).toBeVisible();
    await expect(page.locator('.auth-card >> text=passenger@dride.com')).toBeVisible();
  });

  test('should submit a support ticket successfully and reset form', async ({ page }) => {
    await page.goto('/contact');

    // Attempt to submit empty form -> HTML5 validation prevents it
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Fill form details
    await page.fill('#subject', 'Double billing on trip 1');
    await page.fill('#message', 'Hello, my wallet was debited twice for booking #booking-1. Please assist.');

    // Click submit
    await submitBtn.click();

    // Verify success banner and content
    await expect(page.locator('text=Ticket Submitted!')).toBeVisible();
    await expect(page.locator('text=Thank you for contacting D-Ride')).toBeVisible();

    // Click submit another ticket button
    await page.click('button:has-text("Submit Another Ticket")');

    // Form should reset and be visible again
    await expect(page.locator('#subject')).toHaveValue('');
    await expect(page.locator('#message')).toHaveValue('');
  });
});
