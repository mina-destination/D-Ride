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
    await expect(page.locator('text=Booking Summary')).toBeVisible();

    // Check fare starts at 0 EGP because no seat is selected
    await expect(page.locator('.auth-button')).toBeDisabled();
    await expect(page.locator('text=Total Fare >> ..')).toContainText('0 EGP');
  });

  test('should render 14 seats and handle seat selections correctly', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    const busCabin = page.locator('.bus-cabin');
    await expect(busCabin).toBeVisible();

    // Check occupied seats are rendered with occupied class
    const seat2 = page.locator('.bus-seat:text-is("2")');
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
    const seat1 = page.locator('.bus-seat:text-is("1")');
    await expect(seat1).not.toHaveClass(/selected/);
    await seat1.click();
    await expect(seat1).toHaveClass(/selected/);

    // Check seat details card displays selected slot
    await expect(page.locator('.seat-characteristic-card-slots')).toContainText('Seat #1');
    await expect(page.locator('text=Total Fare >> ..')).toContainText('65 EGP');

    // Click another available seat 3
    const seat3 = page.locator('.bus-seat:text-is("3")');
    await seat3.click();
    await expect(seat3).toHaveClass(/selected/);
    await expect(page.locator('text=Total Fare >> ..')).toContainText('130 EGP');

    // Checkout button should now be enabled
    await expect(page.locator('.auth-button')).toBeEnabled();

    // Clicking again deselects it
    await seat3.click();
    await expect(seat3).not.toHaveClass(/selected/);
    await expect(page.locator('text=Total Fare >> ..')).toContainText('65 EGP');
  });

  test('should toggle payment methods and handle cash checkout', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    // Select seat 1 to enable checkout button
    await page.locator('.bus-seat:text-is("1")').click();

    // Toggle Card payment (default)
    const cardBtn = page.locator('.payment-method-btn:has-text("Card")');
    await expect(cardBtn).toHaveClass(/active/);

    // Toggle Wallet payment
    const walletBtn = page.locator('.payment-method-btn:has-text("Wallet")');
    await walletBtn.click();
    await expect(walletBtn).toHaveClass(/active/);
    await expect(page.locator('text=Mobile Wallet Number')).toBeVisible();

    // Fill invalid wallet number and trigger submit -> should show alert dialog
    await page.fill('input[placeholder="e.g. 01012345678"]', '12345');
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Please enter a valid Egyptian mobile wallet number');
      await dialog.dismiss();
    });
    await page.click('button:has-text("Pay 65 EGP via Paymob")');

    // Fill valid wallet number
    await page.fill('input[placeholder="e.g. 01012345678"]', '01012345678');

    // Toggle Cash payment
    const cashBtn = page.locator('.payment-method-btn:has-text("Cash")');
    await cashBtn.click();
    await expect(cashBtn).toHaveClass(/active/);
    await expect(page.locator('strong:has-text("Cash on Board")')).toBeVisible();

    // Click Confirm Cash booking -> should redirect to my-trips page
    await page.click('button:has-text("Confirm Booking (Cash)")');
    await expect(page).toHaveURL('/my-trips');
  });
});
