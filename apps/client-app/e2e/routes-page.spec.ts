import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_ROUTES } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Routes Explorer Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should load routes and display route cards with details', async ({ page }) => {
    await page.goto('/routes');

    // Header section
    await expect(page.locator('h1')).toContainText('D-Ride Routes Explorer');

    // Route cards should render
    const firstRoute = MOCK_ROUTES[0];
    await expect(page.locator(`text=${firstRoute.name}`).first()).toBeVisible();

    // Check distance badge
    await expect(page.locator(`text=${firstRoute.distanceKm} km`).first()).toBeVisible();

    // Check start/end stops are rendered
    const startStop = firstRoute.checkpoints[0];
    const endStop = firstRoute.checkpoints[firstRoute.checkpoints.length - 1];
    await expect(page.locator(`text=${startStop.name}`).first()).toBeVisible();
    await expect(page.locator(`text=${endStop.name}`).first()).toBeVisible();

    // Duration is shown
    await expect(page.locator(`text=${firstRoute.estimatedDurationMinutes}`).first()).toBeVisible();
  });

  test('should navigate to search page when clicking Book Ride button', async ({ page }) => {
    await page.goto('/routes');

    const route = MOCK_ROUTES[0];
    // Wait for route cards to render
    await expect(page.locator(`text=${route.name}`).first()).toBeVisible();

    // Click the "Book Ride" button on the first route card
    const bookBtn = page.locator('button:has-text("Book Ride")').first();
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // Should navigate to the search page with routeId
    await expect(page).toHaveURL(new RegExp(`\\/search\\?routeId=${route._id}`));
  });

  test('should show empty state when no routes are available', async ({ page }) => {
    // Override routes endpoint to return empty array
    await page.route(/\/api\/routes(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/routes');

    await expect(page.locator('text=No Routes Registered')).toBeVisible();
  });

  test('should display timeline checkpoints for the active route', async ({ page }) => {
    await page.goto('/routes');

    const route = MOCK_ROUTES[0];
    // Wait for the route to be loaded
    await expect(page.locator(`text=${route.name}`).first()).toBeVisible();

    // Verify timeline section renders checkpoint names
    for (const cp of route.checkpoints) {
      await expect(page.locator(`text=${cp.name}`).first()).toBeVisible();
    }
  });
});
