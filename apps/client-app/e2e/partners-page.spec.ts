import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_PARTNERS } from './helpers/mock-api';

test.describe('Partners Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should load partners page and display partner cards', async ({ page }) => {
    await page.goto('/partners');

    // Header
    await expect(page.locator('h1')).toContainText('Partners');

    // Partner cards
    for (const partner of MOCK_PARTNERS) {
      await expect(page.locator(`text=${partner.name}`).first()).toBeVisible();
    }

    // Verified Partner badge
    await expect(page.locator('text=Verified Partner').first()).toBeVisible();
  });

  test('should show visit website link for partners with websiteUrl', async ({ page }) => {
    await page.goto('/partners');

    const partnerWithSite = MOCK_PARTNERS.find(p => p.websiteUrl);
    if (partnerWithSite) {
      const visitBtn = page.locator(`a:has-text("Visit Website")`).first();
      await expect(visitBtn).toBeVisible();
      await expect(visitBtn).toHaveAttribute('target', '_blank');
    }
  });

  test('should show empty state when no partners are available', async ({ page }) => {
    await page.route('**/api/partners', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/partners');

    await expect(page.locator('text=No active partners found')).toBeVisible();
  });

  test('should display core values section', async ({ page }) => {
    await page.goto('/partners');

    await expect(page.locator('text=Why We Value Partnerships')).toBeVisible();
    await expect(page.locator('text=Academic Excellence')).toBeVisible();
    await expect(page.locator('text=Secure Financial Integration')).toBeVisible();
    await expect(page.locator('text=Next-Gen Infrastructure')).toBeVisible();
  });
});
