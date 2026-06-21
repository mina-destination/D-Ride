import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_TRIPS } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Checkout & Seat Selection Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should load checkout page and display trip summary', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    await expect(page.locator('h1')).toHaveText('Toyota HiAce Seat Selection');
    await expect(page.locator('text=Boarding & Dropoff Checkpoints')).toBeVisible();

    // Check fare starts at 0 EGP because no seat is selected
    await expect(page.locator('.auth-button')).toBeDisabled();
    await expect(page.locator('.checkout-selection-box')).toContainText('0 of 1 Selected');
    await expect(page.locator('text=Total Cost >> ..')).toContainText('0 EGP');
  });

  test('should render 14 seats and handle seat selections correctly', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}&passengers=2`);

    const busCabin = page.locator('.bus-cabin');
    await expect(busCabin).toBeVisible();

    // Check occupied seats are rendered with occupied class
    const seat2 = page.locator('.bus-seat').filter({ hasText: /^2$/ });
    await expect(seat2).toHaveClass(/occupied/);

    // Clicking occupied seat should not select it
    await seat2.click();
    await expect(seat2).not.toHaveClass(/selected/);

    // Check locked seat (luggage hold) is rendered with locked-luggage class
    // In our mock, seat 10 is locked
    const seat10 = page.locator('.bus-seat.locked-luggage');
    await expect(seat10).toBeVisible();
    await seat10.click();
    await expect(seat10).not.toHaveClass(/selected/);

    // Click available seat 1
    const seat1 = page.locator('.bus-seat').filter({ hasText: /^1$/ });
    await expect(seat1).not.toHaveClass(/selected/);
    await seat1.click();
    await expect(seat1).toHaveClass(/selected/);

    // Check seat details card displays selected slot
    await expect(page.locator('.checkout-selection-box')).toContainText('#1');
    await expect(page.locator('.checkout-selection-box')).toContainText('1 of 2 Selected');
    await expect(page.locator('text=Total Cost >> ..')).toContainText('65 EGP');

    // Click another available seat 3
    const seat3 = page.locator('.bus-seat').filter({ hasText: /^3$/ });
    await seat3.click();
    await expect(seat3).toHaveClass(/selected/);
    await expect(page.locator('text=Total Cost >> ..')).toContainText('130 EGP');

    // Checkout button should now be enabled
    await expect(page.locator('.auth-button')).toBeEnabled();

    // Clicking again deselects it
    await seat3.click();
    await expect(seat3).not.toHaveClass(/selected/);
    await expect(page.locator('text=Total Cost >> ..')).toContainText('65 EGP');
  });

  test('should handle card checkout', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    // Select seat 1 to enable checkout button
    await page.locator('.bus-seat').filter({ hasText: /^1$/ }).click();

    // Click proceed to payment
    await page.locator('.auth-button').click();

    // Navigates to payment page
    await expect(page).toHaveURL(new RegExp(`\\/payment\\?bookingId=`));

    // Verify Card payment is active by default
    await expect(page.locator('.payment-card-option:has-text("Credit Card")')).toHaveClass(/active/);

    // Click Confirm Card booking -> should redirect to my-trips page
    await page.click('button:has-text("Pay 65 EGP via Paymob")');
    await page.click('button:has-text("View My Trips")');
    await expect(page).toHaveURL('/my-trips');
  });
});
