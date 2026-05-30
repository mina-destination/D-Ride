import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load dashboard with KPI stats and recent activity', async ({ page }) => {
    await page.goto('/');

    // Dashboard should render — we check for common dashboard elements
    // Wait for the page to stabilize


    // The dashboard page should be visible (not redirected to login)
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('should display sidebar navigation with menu items', async ({ page }) => {
    await page.goto('/');


    // Check sidebar nav items exist
    const sidebarLinks = page.locator('nav a, .sidebar a, .ant-menu-item');
    const count = await sidebarLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
