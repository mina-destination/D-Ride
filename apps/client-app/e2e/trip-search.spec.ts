import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_ROUTES, MOCK_TRIPS } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Trip Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should display "No Route Selected" message if routeId param is missing', async ({ page }) => {
    await page.goto('/search');

    await expect(page.locator('text=No Route Selected')).toBeVisible();
    await expect(page.locator('text=Please go back and select a route')).toBeVisible();

    const backBtn = page.locator('button:has-text("Back to Home")');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/');
  });

  test('should show available trips and handle search parameters correctly', async ({ page }) => {
    const route = MOCK_ROUTES[0];
    await page.goto(`/search?routeId=${route._id}`);

    // Verify page header
    await expect(page.locator('h1')).toHaveText('Available Trips');
    await expect(page.locator('text=' + route.name)).toBeVisible();

    // Verify trip cards are rendered
    const tripCards = page.locator('.trip-card');
    await expect(tripCards).toHaveCount(2);

    // Verify trip details on the first card
    const firstCard = tripCards.first();
    await expect(firstCard.locator('.trip-price')).toContainText('65 EGP');

    // Available seats calculation: 14 available - 3 booked = 11 seats left
    await expect(firstCard.locator('.trip-seats')).toContainText('11 seats left');

    // Verify amenities render
    await expect(firstCard.locator('.trip-amenities')).toBeVisible();

    // Verify checkpoint timeline displays checkpoints
    await expect(firstCard.locator('text=Boarding Checkpoint Timeline')).toBeVisible();
    await expect(firstCard.locator('.checkpoint-step >> text=Maadi Square')).toBeVisible();
    await expect(firstCard.locator('.checkpoint-step >> text=Ring Road')).toBeVisible();
    await expect(firstCard.locator('.checkpoint-step >> text=Smart Village Gate')).toBeVisible();
  });

  test('should update selected checkpoint and navigate to checkout when clicking Book Seat', async ({ page }) => {
    // Authenticate user to bypass redirect on checkout click
    await loginAsTestUser(page);

    const route = MOCK_ROUTES[0];
    await page.goto(`/search?routeId=${route._id}`);

    const firstCard = page.locator('.trip-card').first();

    // Select "Ring Road" checkpoint on first trip
    await firstCard.locator('.checkpoint-step >> text=Ring Road').click();

    // Click Book Seat
    await firstCard.locator('button:has-text("Book Seat")').click();

    // Should navigate to checkout with correct tripId and checkpointName query params
    await expect(page).toHaveURL(
      new RegExp(`\\/checkout\\?tripId=${MOCK_TRIPS[0]._id}&checkpointName=${encodeURIComponent('Ring Road')}`)
    );
  });

  test('should show empty state if route has no scheduled trips', async ({ page }) => {
    // Override /api/trips/search response to return no trips
    await page.route('**/api/trips/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    const route = MOCK_ROUTES[0];
    await page.goto(`/search?routeId=${route._id}`);

    await expect(page.locator('text=No trips found')).toBeVisible();
    await expect(page.locator('text=We couldn\'t find any scheduled trips')).toBeVisible();
  });
});
