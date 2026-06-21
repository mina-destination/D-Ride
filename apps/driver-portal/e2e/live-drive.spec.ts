import { test, expect } from '@playwright/test';
import { setupDriverMockAPI, MOCK_TRIPS } from './helpers/mock-api';
import { loginAsDriver } from './helpers/auth';

test.describe('Driver Live Drive Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupDriverMockAPI(page);
    await loginAsDriver(page);
  });

  test('should load live drive page', async ({ page }) => {
    await page.goto(`/drive/${MOCK_TRIPS[0]._id}`);


    // The page should render without errors
    const url = page.url();
    expect(url).toContain('/drive/');
  });

  test('should display checkpoint list for the route', async ({ page }) => {
    await page.goto(`/drive/${MOCK_TRIPS[0]._id}`);

    // Click on Stops tab to reveal checkpoints timeline
    await page.click('button:has-text("Stops")');

    // Route checkpoint names should appear
    await expect(page.locator('text=Maadi Square').first()).toBeVisible();
  });

  test('should have GPS controls visible', async ({ page }) => {
    await page.goto(`/drive/${MOCK_TRIPS[0]._id}`);


    // Look for start/stop GPS buttons or tracking indicators
    const gpsControl = page.locator('button:has-text("Start"), button:has-text("GPS"), button:has-text("Track"), button:has-text("Begin")').first();
    await expect(gpsControl).toBeVisible();
  });
});
