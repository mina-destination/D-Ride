import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';

test.describe('Static Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test.describe('About Page', () => {
    test('should load about page with all sections', async ({ page }) => {
      await page.goto('/about');

      // Header
      await expect(page.locator('h1')).toContainText('About');
      await expect(page.locator('h1')).toContainText('D-Ride');

      // Our Story badge
      await expect(page.locator('text=Our Story')).toBeVisible();

      // Mission section
      await expect(page.locator('text=Our Mission & Vision')).toBeVisible();

      // Core values section
      await expect(page.locator('text=Our Core Values')).toBeVisible();
      await expect(page.locator('h3:has-text("Premium Comfort")')).toBeVisible();
      await expect(page.locator('h3:has-text("Smart Technology")')).toBeVisible();
      await expect(page.locator('h3:has-text("Absolute Safety")')).toBeVisible();

      // Partnerships callout
      await expect(page.locator('text=Backed by Trusted Partnerships')).toBeVisible();
    });

    test('should display D-Ride logo image', async ({ page }) => {
      await page.goto('/about');

      const logo = page.locator('img[alt="D-Ride Logo"]').first();
      await expect(logo).toBeVisible();
    });
  });

  test.describe('Terms Page', () => {
    test('should load terms page with content', async ({ page }) => {
      await page.goto('/terms');

      await expect(page.locator('h1')).toBeVisible();
      // The page should have scrollable content sections
      const contentSections = page.locator('h2');
      const count = await contentSections.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Privacy Page', () => {
    test('should load privacy page with content', async ({ page }) => {
      await page.goto('/privacy');

      await expect(page.locator('h1')).toBeVisible();
      const contentSections = page.locator('h2');
      const count = await contentSections.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});
