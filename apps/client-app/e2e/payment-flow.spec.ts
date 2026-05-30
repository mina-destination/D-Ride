import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_TRIPS, MOCK_ROUTES } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Payment Flow Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should show "no booking selected" when bookingId is missing', async ({ page }) => {
    await page.goto('/payment');

    await expect(page.locator('text=No Booking Selected')).toBeVisible();
  });

  test('should load booking summary and payment methods', async ({ page }) => {
    await page.goto('/payment?bookingId=booking-1');

    // Header
    await expect(page.locator('h1')).toContainText('Secure Ride Payment');

    // Payment method cards
    await expect(page.locator('.payment-card-option:has-text("Credit Card")')).toBeVisible();
    await expect(page.locator('.payment-card-option:has-text("Cash on Board")')).not.toBeVisible();

    // Credit Card should be active by default
    await expect(page.locator('.payment-card-option:has-text("Credit Card")')).toHaveClass(/active/);

    // Reservation summary
    await expect(page.locator('text=Maadi to Smart Village').first()).toBeVisible();
    await expect(page.locator('text=#1').first()).toBeVisible();
  });

  test('should show billing details with total amount', async ({ page }) => {
    await page.goto('/payment?bookingId=booking-1');

    // Billing section
    await expect(page.locator('text=130 EGP').first()).toBeVisible();
  });

  test('should confirm card booking and redirect to my-trips', async ({ page }) => {
    await page.goto('/payment?bookingId=booking-1');

    // Click confirm
    await page.click('button:has-text("Pay 130 EGP via Paymob")');
    await page.click('button:has-text("View My Trips")');

    // Should redirect to my-trips
    await expect(page).toHaveURL('/my-trips');
  });

  test('should display visual stepper with 3 steps', async ({ page }) => {
    await page.goto('/payment?bookingId=booking-1');

    // Stepper labels
    await expect(page.locator('.stepper-label').first()).toBeVisible();
    const steppers = page.locator('.stepper-label');
    const count = await steppers.count();
    expect(count).toBe(3);
  });
});
