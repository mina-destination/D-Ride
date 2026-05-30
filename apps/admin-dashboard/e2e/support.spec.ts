import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Support Tickets Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load support tickets page and display tickets', async ({ page }) => {
    await page.goto('/support-tickets');


    await expect(page.locator('text=Double billing issue').first()).toBeVisible();
    await expect(page.locator('text=OPEN').first()).toBeVisible();
  });

  test('should display ticket submitter info', async ({ page }) => {
    await page.goto('/support-tickets');


    await expect(page.locator('text=Test Passenger').first()).toBeVisible();
  });
});
