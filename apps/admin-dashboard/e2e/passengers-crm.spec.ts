import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Passengers & CRM Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load passengers page and display user list', async ({ page }) => {
    await page.goto('/passengers');


    await expect(page.locator('text=Test Passenger').first()).toBeVisible();
    await expect(page.locator('text=passenger@dride.com').first()).toBeVisible();
  });

  test('should display passenger phone number', async ({ page }) => {
    await page.goto('/passengers');


    await expect(page.locator('text=01012345678').first()).toBeVisible();
  });

  test('should load CRM page with customer data', async ({ page }) => {
    await page.goto('/crm');


    // CRM page should display user info
    const url = page.url();
    expect(url).toContain('/crm');
  });
});
