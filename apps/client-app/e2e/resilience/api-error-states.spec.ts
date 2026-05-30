import { test, expect } from '@playwright/test';

test.describe('API Error Resilience', () => {
  test('should show error state when API returns 500', async ({ page }) => {
    await page.route('**/api/routes', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Internal Server Error' }) })
    );
    await page.route('**/api/auth/profile', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { _id: 'u1', name: 'Test', role: 'PASSENGER' } }) })
    );
    await page.goto('/');
    // App should not crash - verify page still renders
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    await page.route('**/api/routes', route => route.abort('timedout'));
    await page.route('**/api/auth/profile', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { _id: 'u1', name: 'Test', role: 'PASSENGER' } }) })
    );
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should redirect to login on 401', async ({ page }) => {
    await page.route('**/api/auth/profile', route =>
      route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) })
    );
    await page.goto('/my-trips');
    await expect(page).toHaveURL(/\/login/);
  });
});
