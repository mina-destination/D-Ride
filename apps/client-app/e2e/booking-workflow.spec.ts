import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_ROUTES, MOCK_TRIPS } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Full Booking Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should complete full booking: Home → Search → Checkout → Payment → My Trips', async ({ page }) => {
    // Step 1: Home page — search for route
    await page.goto('/');
    await expect(page.locator('.hero-title')).toBeVisible();

    // Search boarding stop
    const fromInput = page.locator('input[placeholder="Search boarding stop..."]');
    await fromInput.fill('Ring Road');
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Ring Road")').click();

    // Search destination stop
    const toInput = page.locator('input[placeholder="Search destination stop..."]');
    await toInput.fill('Smart Village Gate');
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Smart Village Gate")').click();

    // Click search
    await page.click('#search-trips-btn');
    await page.waitForURL(new RegExp('\\/search\\?pickupLat='));

    // Step 2: Trip Search page — select trip and click Book
    await expect(page.locator('.trip-card').first()).toBeVisible();
    await page.locator('button:has-text("Book Seat")').first().click();
    await page.waitForURL(new RegExp('\\/checkout\\?tripId='));

    // Step 3: Checkout page — select seat and proceed
    await expect(page.locator('.bus-cabin')).toBeVisible();

    // Select seat 1
    const seat1 = page.locator('.bus-seat').filter({ hasText: /^1$/ });
    await seat1.click();
    await expect(seat1).toHaveClass(/selected/);
    await expect(page.locator('text=Total Fare >> ..')).toContainText('65 EGP');

    // Click checkout
    await page.click('.auth-button');
    await page.waitForURL(new RegExp('\\/payment\\?bookingId='));

    // Step 4: Payment page — Card payment is default, click checkout button
    await page.click('button:has-text("Pay 65 EGP via Paymob")');
    await page.click('button:has-text("View My Trips")');

    // Step 5: Should arrive at My Trips
    await page.waitForURL('/my-trips');
  });

  test('should correctly mark locked seats (luggage) as unclickable', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    // In mock data, seat 10 is locked
    const lockedSeat = page.locator('.bus-seat.locked-luggage');
    await expect(lockedSeat).toBeVisible();

    // Clicking a locked seat should NOT select it
    await lockedSeat.click();
    await expect(lockedSeat).not.toHaveClass(/selected/);
  });

  test('should correctly mark occupied seats as unclickable', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}`);

    // In mock data, seats 2, 5, 8 are occupied
    const seat2 = page.locator('.bus-seat').filter({ hasText: /^2$/ });
    await expect(seat2).toHaveClass(/occupied/);

    await seat2.click();
    await expect(seat2).not.toHaveClass(/selected/);
  });

  test('should calculate fare correctly for multiple seats', async ({ page }) => {
    await page.goto(`/checkout?tripId=${MOCK_TRIPS[0]._id}&passengers=3`);

    // Select 3 seats
    const seat1 = page.locator('.bus-seat').filter({ hasText: /^1$/ });
    const seat3 = page.locator('.bus-seat').filter({ hasText: /^3$/ });
    const seat4 = page.locator('.bus-seat').filter({ hasText: /^4$/ });

    await seat1.click();
    await expect(page.locator('text=Total Fare >> ..')).toContainText('65 EGP');

    await seat3.click();
    await expect(page.locator('text=Total Fare >> ..')).toContainText('130 EGP');

    await seat4.click();
    await expect(page.locator('text=Total Fare >> ..')).toContainText('195 EGP');

    // Deselect seat 3
    await seat3.click();
    await expect(page.locator('text=Total Fare >> ..')).toContainText('130 EGP');
  });

  test('should display correct available seats count on trip search', async ({ page }) => {
    const route = MOCK_ROUTES[0];
    await page.goto(`/search?routeId=${route._id}`);

    const firstCard = page.locator('.trip-card').first();

    // MOCK_TRIPS[0]: availableSeats=14, bookedSeats=3, lockedCount=1 → 10 seats left
    await expect(firstCard.locator('.trip-seats')).toContainText('10 seats left');

    // MOCK_TRIPS[1]: availableSeats=14, bookedSeats=12 → 2 seats left
    const secondCard = page.locator('.trip-card').nth(1);
    await expect(secondCard.locator('.trip-seats')).toContainText('2 seats left');
  });
});
